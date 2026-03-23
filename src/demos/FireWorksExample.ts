// demos/FireworksExample.ts
import { NullGraph, Camera } from 'null-graph';

export async function setupFireworks(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {

    // 1. GEOMETRY (Standard Cubes and Pyramids)
    const cubeVertices = new Float32Array([
        -0.5, -0.5,  0.5,   0,0,1,    0.5, -0.5,  0.5,   0,0,1,    0.5,  0.5,  0.5,   0,0,1,   -0.5,  0.5,  0.5,   0,0,1,
        0.5, -0.5, -0.5,   0,0,-1,  -0.5, -0.5, -0.5,   0,0,-1,  -0.5,  0.5, -0.5,   0,0,-1,   0.5,  0.5, -0.5,   0,0,-1,
        -0.5,  0.5,  0.5,   0,1,0,    0.5,  0.5,  0.5,   0,1,0,    0.5,  0.5, -0.5,   0,1,0,   -0.5,  0.5, -0.5,   0,1,0,
    ]); // Top face added for better ground visibility
    const cubeIndices = new Uint16Array([0,1,2, 2,3,0,  4,5,6, 6,7,4,  8,9,10, 10,11,8]);

    const pyramidVertices = new Float32Array([
        -0.5, -0.5,  0.5,  0,0.5,1,   0.5, -0.5,  0.5,  0,0.5,1,   0.0,  0.5,  0.0,  0,0.5,1,
        0.5, -0.5,  0.5,  1,0.5,0,   0.5, -0.5, -0.5,  1,0.5,0,   0.0,  0.5,  0.0,  1,0.5,0,
        -0.5, -0.5, -0.5, -1,0.5,0,  -0.5, -0.5,  0.5, -1,0.5,0,   0.0,  0.5,  0.0, -1,0.5,0,
    ]);
    const pyramidIndices = new Uint16Array([0,1,2,  3,4,5,  6,7,8]);

    const cubeVBO = engine.bufferManager.createVertexBuffer(cubeVertices);
    const cubeIBO = engine.bufferManager.createIndexBuffer(cubeIndices);
    const pyrVBO = engine.bufferManager.createVertexBuffer(pyramidVertices);
    const pyrIBO = engine.bufferManager.createIndexBuffer(pyramidIndices);

    // 2. UNIVERSAL SHADER & BATCHES
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) norm: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            
            // Dramatic up-lighting for fireworks!
            let light = max(dot(norm, normalize(vec3<f32>(0.0, 1.0, 0.2))), 0.2);
            out.color = color * light;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    const config = {
        shaderCode: shaderSource, strideFloats: 14, maxInstances: 15000,
        vertexLayouts: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat }, { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat }] }]
    };

    const groundBatch = engine.createBatch(config);
    engine.setBatchGeometry(groundBatch, cubeVBO, cubeIBO, cubeIndices.length);

    const rocketBatch = engine.createBatch(config);
    engine.setBatchGeometry(rocketBatch, pyrVBO, pyrIBO, pyramidIndices.length);

    const sparkBatch = engine.createBatch(config);
    engine.setBatchGeometry(sparkBatch, cubeVBO, cubeIBO, cubeIndices.length);

    // 3. ECS RENDER BUFFERS (Sent to GPU)
    const ROCKET_COUNT = 20;
    const SPARK_COUNT = 15000;

    const groundData = new Float32Array(1 * 14); // 1 giant cube
    const rocketData = new Float32Array(ROCKET_COUNT * 14);
    const sparkData = new Float32Array(SPARK_COUNT * 14);

    // Setup Ground
    groundData[1] = 0; groundData[2] = -50; groundData[3] = 0; // Pos
    groundData[8] = 200; groundData[9] = 5; groundData[10] = 200; // Scale
    groundData[11] = 0.1; groundData[12] = 0.1; groundData[13] = 0.15; // Color

    // 4. CPU PHYSICS BUFFERS (Secret sauce: Never goes to GPU!)
    // For sparks: [VelocityX, VelocityY, VelocityZ, Life] -> Stride of 4
    const sparkPhysics = new Float32Array(SPARK_COUNT * 4);
    let sparkPoolIndex = 0; // Tracks which spark we recycle next

    // Hide everything initially
    for(let i=0; i<ROCKET_COUNT; i++) rocketData[i*14 + 2] = -999;
    for(let i=0; i<SPARK_COUNT; i++) sparkData[i*14 + 2] = -999;

    // Helper: Explode a rocket into 500 sparks
    function spawnExplosion(x: number, y: number, z: number) {
        const colorR = Math.random(); const colorG = Math.random(); const colorB = Math.random();

        for (let i = 0; i < 500; i++) {
            const pBase = sparkPoolIndex * 4;
            const gBase = sparkPoolIndex * 14;

            // Random spherical velocity
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = Math.random() * 2.0;

            sparkPhysics[pBase + 0] = Math.sin(phi) * Math.cos(theta) * speed; // Vel X
            sparkPhysics[pBase + 1] = Math.sin(phi) * Math.sin(theta) * speed; // Vel Y
            sparkPhysics[pBase + 2] = Math.cos(phi) * speed;                   // Vel Z
            sparkPhysics[pBase + 3] = 60 + Math.random() * 40;                 // Life (frames)

            // Setup GPU data
            sparkData[gBase + 1] = x; sparkData[gBase + 2] = y; sparkData[gBase + 3] = z;
            sparkData[gBase + 11] = colorR; sparkData[gBase + 12] = colorG; sparkData[gBase + 13] = colorB;

            sparkPoolIndex = (sparkPoolIndex + 1) % SPARK_COUNT; // Loop around the pool
        }
    }

    // 5. THE GAME LOOP
    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            const gravity = -0.05 * uiState.amplitude;

            // A. Manage Rockets
            for (let i = 0; i < ROCKET_COUNT; i++) {
                const b = i * 14;
                if (rocketData[b + 2] < -100) {
                    // Launch new rocket!
                    if (Math.random() < 0.02) {
                        rocketData[b + 1] = (Math.random() - 0.5) * 80; // X
                        rocketData[b + 2] = -40; // Y Start
                        rocketData[b + 3] = (Math.random() - 0.5) * 80; // Z
                        rocketData[b + 8] = 2; rocketData[b + 9] = 4; rocketData[b + 10] = 2; // Scale
                        rocketData[b + 11] = 1; rocketData[b + 12] = 0.5; rocketData[b + 13] = 0; // Orange
                    }
                } else {
                    // Fly up
                    rocketData[b + 2] += 1.5 * uiState.amplitude;
                    // Explode at random height
                    if (rocketData[b + 2] > 20 + Math.random() * 40) {
                        spawnExplosion(rocketData[b + 1], rocketData[b + 2], rocketData[b + 3]);
                        rocketData[b + 2] = -999; // Hide rocket
                    }
                }
            }

            // B. Manage 15,000 Sparks (This is where DOD crushes OOP!)
            for (let i = 0; i < SPARK_COUNT; i++) {
                const pBase = i * 4;

                // Only process alive sparks
                if (sparkPhysics[pBase + 3] > 0) {
                    const gBase = i * 14;

                    // Apply physics
                    sparkData[gBase + 1] += sparkPhysics[pBase + 0] * uiState.amplitude; // X
                    sparkData[gBase + 2] += sparkPhysics[pBase + 1] * uiState.amplitude; // Y
                    sparkData[gBase + 3] += sparkPhysics[pBase + 2] * uiState.amplitude; // Z

                    sparkPhysics[pBase + 1] += gravity; // Gravity pulls Y velocity down
                    sparkPhysics[pBase + 3] -= 1 * uiState.amplitude; // Decrease Life

                    // Shrink scale as it dies (Magic visual effect without alpha blending!)
                    const scale = (sparkPhysics[pBase + 3] / 100) * 1.5;
                    sparkData[gBase + 8] = scale; sparkData[gBase + 9] = scale; sparkData[gBase + 10] = scale;

                    // Hide if dead
                    if (sparkPhysics[pBase + 3] <= 0) sparkData[gBase + 2] = -999;
                }
            }

            engine.updateBatchData(groundBatch, groundData, 1);
            engine.updateBatchData(rocketBatch, rocketData, ROCKET_COUNT);
            engine.updateBatchData(sparkBatch, sparkData, SPARK_COUNT);
        },
        destroy: () => { engine.clearBatches(); }
    };
}