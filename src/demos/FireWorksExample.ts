// demos/FireworksExample.ts
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";

export async function setupFireworks(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {

    // 1. DYNAMIC GEOMETRY SETUP
    const cubeGeom = Primitives.createCube(StandardLayout, 1.0, 1.0, 1.0);
    cubeGeom.upload(engine);

    const pyrGeom = Primitives.createPyramid(StandardLayout, 1.0, 2.0, 1.0);
    pyrGeom.upload(engine);

    // =========================================================
    // 2. OFFSCREEN TEXTURES (For the pristine 3D render)
    // =========================================================
    const offscreenTexture = engine.device.createTexture({
        size: [2048, 2048],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const offscreenDepth = engine.device.createTexture({
        size: [2048, 2048],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const sampler = engine.device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
    });

    // =========================================================
    // 3. PASS 1: OFFSCREEN FIREWORKS SCENE
    // =========================================================
    const scenePass = engine.createPass({
        name: 'Offscreen Fireworks Scene',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 }, // Dark night sky
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const sceneShaderSource = `
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
            
            // Dramatic up-lighting
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
        shaderCode: sceneShaderSource,
        strideFloats: 14,
        maxInstances: 15000,
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    };

    // Attach scene batches to the offscreen pass
    const groundBatch = engine.createBatch(scenePass, config);
    engine.setBatchGeometry(groundBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    const rocketBatch = engine.createBatch(scenePass, config);
    engine.setBatchGeometry(rocketBatch, pyrGeom.vertexBuffer!, pyrGeom.indexBuffer!, pyrGeom.indices.length);

    const sparkBatch = engine.createBatch(scenePass, config);
    engine.setBatchGeometry(sparkBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);


    // =========================================================
    // 4. PASS 2: CINEMATIC LENS POST-PROCESSING
    // =========================================================
    const postPass = engine.createPass({
        name: 'Cinematic Post Process',
        isMainScreenPass: true
    });

    const postShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        @group(1) @binding(0) var screenTex: texture_2d<f32>;
        @group(1) @binding(1) var screenSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
            // Full screen triangle
            var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0));
            var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
            var out: VertexOut;
            let _keepCameraAlive = camera.viewProj[0][0];
            out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
            out.uv = uv[vIdx];
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            let time = ecs[0];

            // 1. Radial Chromatic Aberration (stronger at edges)
            let center = vec2<f32>(0.5, 0.5);
            let distToCenter = length(uv - center);
            let dir = normalize(uv - center);
            let caStrength = distToCenter * 0.015; // Pushes RGB apart at the edges

            let r = textureSample(screenTex, screenSamp, uv + (dir * caStrength)).r;
            let g = textureSample(screenTex, screenSamp, uv).g;
            let b = textureSample(screenTex, screenSamp, uv - (dir * caStrength)).b;
            var color = vec3<f32>(r, g, b);

            // 2. Overexposure / Pseudo-Bloom
            // Isolate the brightest parts of the image and boost them
            let luminance = dot(color, vec3<f32>(0.299, 0.587, 0.114));
            let glowMask = smoothstep(0.6, 1.0, luminance); 
            color += (color * glowMask * 1.5); // Add hot, glowing centers to sparks

            // 3. Cinematic Vignette (Darken corners)
            let vignette = smoothstep(0.85, 0.3, distToCenter);
            color *= vignette;

            // 4. Subtle Film Grain
            let noise = fract(sin(dot(uv.xy + time, vec2<f32>(12.9898, 78.233))) * 43758.5453);
            color += vec3<f32>(noise * 0.04); 

            // Tone mapping to keep super brights from blowing out to pure white uniformly
            color = color / (color + vec3<f32>(1.0));
            // Gamma correction
            color = pow(color, vec3<f32>(1.0 / 2.2));

            return vec4<f32>(color, 1.0);
        }
    `;

    const postBatch = engine.createBatch(postPass, {
        shaderCode: postShader,
        strideFloats: 1, // Passing time
        maxInstances: 1,
        vertexLayouts: []
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);


    // =========================================================
    // 5. ECS & PHYSICS SETUP
    // =========================================================
    const ROCKET_COUNT = 20;
    const SPARK_COUNT = 15000;

    const groundData = new Float32Array(1 * 14);
    const rocketData = new Float32Array(ROCKET_COUNT * 14);
    const sparkData = new Float32Array(SPARK_COUNT * 14);
    const postProcessData = new Float32Array([0]); // Holds simTime

    // Setup Ground
    groundData[1] = 0; groundData[2] = -50; groundData[3] = 0;
    groundData[8] = 200; groundData[9] = 5; groundData[10] = 200;
    groundData[11] = 0.1; groundData[12] = 0.1; groundData[13] = 0.15;

    // CPU Physics for sparks
    const sparkPhysics = new Float32Array(SPARK_COUNT * 4);
    let sparkPoolIndex = 0;

    for(let i = 0; i < ROCKET_COUNT; i++) rocketData[i * 14 + 2] = -999;
    for(let i = 0; i < SPARK_COUNT; i++) sparkData[i * 14 + 2] = -999;

    function spawnExplosion(x: number, y: number, z: number) {
        // High intensity base colors to feed the post-processing glow
        const colorR = Math.random() + 0.5;
        const colorG = Math.random() + 0.5;
        const colorB = Math.random() + 0.5;

        for (let i = 0; i < 500; i++) {
            const pBase = sparkPoolIndex * 4;
            const gBase = sparkPoolIndex * 14;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = Math.random() * 2.5;

            sparkPhysics[pBase + 0] = Math.sin(phi) * Math.cos(theta) * speed;
            sparkPhysics[pBase + 1] = Math.sin(phi) * Math.sin(theta) * speed;
            sparkPhysics[pBase + 2] = Math.cos(phi) * speed;
            sparkPhysics[pBase + 3] = 60 + Math.random() * 50;

            sparkData[gBase + 1] = x; sparkData[gBase + 2] = y; sparkData[gBase + 3] = z;
            sparkData[gBase + 11] = colorR; sparkData[gBase + 12] = colorG; sparkData[gBase + 13] = colorB;

            sparkPoolIndex = (sparkPoolIndex + 1) % SPARK_COUNT;
        }
    }

    // =========================================================
    // 6. GAME LOOP
    // =========================================================
    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            const gravity = -0.05 * uiState.amplitude;

            // Manage Rockets
            for (let i = 0; i < ROCKET_COUNT; i++) {
                const b = i * 14;
                if (rocketData[b + 2] < -100) {
                    if (Math.random() < 0.02) {
                        rocketData[b + 1] = (Math.random() - 0.5) * 80;
                        rocketData[b + 2] = -40;
                        rocketData[b + 3] = (Math.random() - 0.5) * 80;
                        rocketData[b + 8] = 2; rocketData[b + 9] = 4; rocketData[b + 10] = 2;
                        rocketData[b + 11] = 2.0; rocketData[b + 12] = 1.0; rocketData[b + 13] = 0.2; // Super bright orange
                    }
                } else {
                    rocketData[b + 2] += 1.5 * uiState.amplitude;
                    if (rocketData[b + 2] > 20 + Math.random() * 40) {
                        spawnExplosion(rocketData[b + 1], rocketData[b + 2], rocketData[b + 3]);
                        rocketData[b + 2] = -999;
                    }
                }
            }

            // Manage Sparks
            for (let i = 0; i < SPARK_COUNT; i++) {
                const pBase = i * 4;
                if (sparkPhysics[pBase + 3] > 0) {
                    const gBase = i * 14;

                    sparkData[gBase + 1] += sparkPhysics[pBase + 0] * uiState.amplitude;
                    sparkData[gBase + 2] += sparkPhysics[pBase + 1] * uiState.amplitude;
                    sparkData[gBase + 3] += sparkPhysics[pBase + 2] * uiState.amplitude;

                    sparkPhysics[pBase + 1] += gravity;
                    sparkPhysics[pBase + 3] -= 1 * uiState.amplitude;

                    const scale = (sparkPhysics[pBase + 3] / 100) * 1.5;
                    sparkData[gBase + 8] = scale; sparkData[gBase + 9] = scale; sparkData[gBase + 10] = scale;

                    if (sparkPhysics[pBase + 3] <= 0) sparkData[gBase + 2] = -999;
                }
            }

            // Upload 3D Scene Data
            engine.updateBatchData(groundBatch, groundData, 1);
            engine.updateBatchData(rocketBatch, rocketData, ROCKET_COUNT);
            engine.updateBatchData(sparkBatch, sparkData, SPARK_COUNT);

            // Upload Post-Process Data (Time for animated film grain)
            postProcessData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessData, 1);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}