// demos/SpaceFleetExample.ts
import { NullGraph, Camera } from 'null-graph';

export async function setupSpaceFleet(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {

    // ----------------------------------------------------------------
    // 1. DEFINE THREE DISTINCT GEOMETRIES
    // ----------------------------------------------------------------

    // A. The Asteroid (Cube)
    const cubeVertices = new Float32Array([
        -0.5, -0.5,  0.5,   0,0,1,    0.5, -0.5,  0.5,   0,0,1,    0.5,  0.5,  0.5,   0,0,1,   -0.5,  0.5,  0.5,   0,0,1, // Front
        0.5, -0.5, -0.5,   0,0,-1,  -0.5, -0.5, -0.5,   0,0,-1,  -0.5,  0.5, -0.5,   0,0,-1,   0.5,  0.5, -0.5,   0,0,-1, // Back
    ]); // Shortened for demo limits
    const cubeIndices = new Uint16Array([0,1,2, 2,3,0,  4,5,6, 6,7,4]);

    // B. The Ship (Pyramid)
    const pyramidVertices = new Float32Array([
        -0.5, -0.5,  0.5,  0,0.5,1,   0.5, -0.5,  0.5,  0,0.5,1,   0.0,  0.5,  0.0,  0,0.5,1, // Front Face
        0.5, -0.5,  0.5,  1,0.5,0,   0.5, -0.5, -0.5,  1,0.5,0,   0.0,  0.5,  0.0,  1,0.5,0, // Right Face
        -0.5, -0.5, -0.5, -1,0.5,0,  -0.5, -0.5,  0.5, -1,0.5,0,   0.0,  0.5,  0.0, -1,0.5,0, // Left Face
    ]);
    const pyramidIndices = new Uint16Array([0,1,2,  3,4,5,  6,7,8]);

    // C. The Laser (Long Quad)
    const quadVertices = new Float32Array([
        -0.1, -1.0, 0.0,  0,0,1,   0.1, -1.0, 0.0,  0,0,1,
        0.1,  1.0, 0.0,  0,0,1,  -0.1,  1.0, 0.0,  0,0,1,
    ]);
    const quadIndices = new Uint16Array([0, 1, 2, 2, 3, 0]);

    // Upload all to VRAM
    const astVBO = engine.bufferManager.createVertexBuffer(cubeVertices);
    const astIBO = engine.bufferManager.createIndexBuffer(cubeIndices);
    const shipVBO = engine.bufferManager.createVertexBuffer(pyramidVertices);
    const shipIBO = engine.bufferManager.createIndexBuffer(pyramidIndices);
    const laserVBO = engine.bufferManager.createVertexBuffer(quadVertices);
    const laserIBO = engine.bufferManager.createIndexBuffer(quadIndices);

    // ----------------------------------------------------------------
    // 2. THE UNIVERSAL SHADER & BATCHES
    // ----------------------------------------------------------------
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

            let worldPos = (localPos * scale) + pos;
            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            
            // Simple lighting
            let light = max(dot(norm, normalize(vec3<f32>(0.5, 1.0, 0.5))), 0.3);
            out.color = color * light;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    const pipelineConfig = {
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: 10000, // Safe max for all
        vertexLayouts: [{
            arrayStride: 6 * 4,
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
                { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat }
            ]
        }]
    };

    // Create 3 distinct Render Batches
    const asteroidBatch = engine.createBatch(pipelineConfig);
    engine.setBatchGeometry(asteroidBatch, astVBO, astIBO, cubeIndices.length);

    const shipBatch = engine.createBatch(pipelineConfig);
    engine.setBatchGeometry(shipBatch, shipVBO, shipIBO, pyramidIndices.length);

    const laserBatch = engine.createBatch(pipelineConfig);
    engine.setBatchGeometry(laserBatch, laserVBO, laserIBO, quadIndices.length);

    // ----------------------------------------------------------------
    // 3. INITIALIZE ECS DATA ARRAYS
    // ----------------------------------------------------------------
    const ASTEROID_COUNT = 5000;
    const SHIP_COUNT = 50;
    const LASER_COUNT = 500;

    const asteroidData = new Float32Array(ASTEROID_COUNT * 14);
    const shipData = new Float32Array(SHIP_COUNT * 14);
    const laserData = new Float32Array(LASER_COUNT * 14);

    // Spawn Asteroids (High up, brown/gray colors)
    for (let i = 0; i < ASTEROID_COUNT; i++) {
        const b = i * 14;
        asteroidData[b + 1] = (Math.random() - 0.5) * 200; // X
        asteroidData[b + 2] = Math.random() * 200;         // Y (Start high)
        asteroidData[b + 3] = (Math.random() - 0.5) * 100; // Z
        asteroidData[b + 8] = asteroidData[b + 9] = asteroidData[b + 10] = Math.random() * 2 + 0.5; // Scale
        asteroidData[b + 11] = 0.4; asteroidData[b + 12] = 0.3; asteroidData[b + 13] = 0.3; // Color
    }

    // Spawn Ships (At the bottom, blue colors)
    const shipBaseX = new Float32Array(SHIP_COUNT); // Store initial X for dodging math
    for (let i = 0; i < SHIP_COUNT; i++) {
        const b = i * 14;
        shipBaseX[i] = asteroidData[b + 1] = (Math.random() - 0.5) * 150;
        shipData[b + 1] = shipBaseX[i];
        shipData[b + 2] = -40; // Y (Stay low)
        shipData[b + 3] = (Math.random() - 0.5) * 20;
        shipData[b + 8] = shipData[b + 9] = shipData[b + 10] = 3.0; // Scale
        shipData[b + 11] = 0.1; shipData[b + 12] = 0.5; shipData[b + 13] = 1.0;
    }

    // Spawn Lasers (Hidden underground initially, bright green)
    for (let i = 0; i < LASER_COUNT; i++) {
        const b = i * 14;
        laserData[b + 2] = -999; // Hidden
        laserData[b + 8] = laserData[b + 9] = laserData[b + 10] = 1.5;
        laserData[b + 11] = 0.0; laserData[b + 12] = 1.0; laserData[b + 13] = 0.2;
    }

    // ----------------------------------------------------------------
    // 4. THE GAME LOOP
    // ----------------------------------------------------------------
    let frameCount = 0;

    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            frameCount++;

            // Update Asteroids (Falling down)
            for (let i = 0; i < ASTEROID_COUNT; i++) {
                const b = i * 14;
                asteroidData[b + 2] -= 0.5 * uiState.amplitude; // Fall
                if (asteroidData[b + 2] < -60) {
                    asteroidData[b + 2] = 100; // Reset to top
                    asteroidData[b + 1] = (Math.random() - 0.5) * 200; // New X
                }
            }

            // Update Ships (Dodging back and forth)
            for (let i = 0; i < SHIP_COUNT; i++) {
                const b = i * 14;
                // Complex dodge pattern based on time and their index
                shipData[b + 1] = shipBaseX[i] + Math.sin(simTime * 2.0 + i) * 15 * uiState.amplitude;
            }

            // Update Lasers (Shooting up)
            for (let i = 0; i < LASER_COUNT; i++) {
                const b = i * 14;
                laserData[b + 2] += 2.0 * uiState.amplitude; // Fly up

                // If laser goes off screen, re-assign it to a random ship! (Object Pooling)
                if (laserData[b + 2] > 100) {
                    const randomShipIndex = Math.floor(Math.random() * SHIP_COUNT);
                    const shipBase = randomShipIndex * 14;
                    laserData[b + 1] = shipData[shipBase + 1]; // Match ship X
                    laserData[b + 2] = shipData[shipBase + 2]; // Match ship Y
                    laserData[b + 3] = shipData[shipBase + 3]; // Match ship Z
                }
            }

            // Blast the 3 distinct arrays to the GPU
            engine.updateBatchData(asteroidBatch, asteroidData, ASTEROID_COUNT);
            engine.updateBatchData(shipBatch, shipData, SHIP_COUNT);
            engine.updateBatchData(laserBatch, laserData, LASER_COUNT);
        },
        destroy: () => {
            engine.clearBatches();
        }
    };
}