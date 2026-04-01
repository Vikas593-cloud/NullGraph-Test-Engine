// demos/SpaceFleetExample.ts
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";

export async function setupSpaceFleet(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {

    // =========================================================
    // 1. OFFSCREEN TEXTURE SETUP (For Post-Processing)
    // =========================================================
    const offscreenTexture = engine.device.createTexture({
        size: [2048, 2048], // High-res buffer
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
    // 2. DYNAMIC GEOMETRY SETUP
    // =========================================================
    const astGeom = Primitives.createCube(StandardLayout, 1.0, 1.0, 1.0);
    astGeom.upload(engine);

    const shipGeom = Primitives.createPyramid(StandardLayout, 1.0, 2.0, 1.0);
    shipGeom.upload(engine);

    const laserGeom = Primitives.createPlane(StandardLayout, 0.5, 2.0);
    laserGeom.upload(engine);

    // ---------------------------------------------------------
    // RENDER PASS 1: The pristine 3D Scene (Offscreen)
    // ---------------------------------------------------------
    const scenePass = engine.createPass({
        name: 'Space Fleet Offscreen Pass',
        isMainScreenPass: false, // Changed to false!
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.0, g: 0.01, b: 0.03, a: 1.0 }, // Deep space void
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const ASTEROID_COUNT = 5000;
    const SHIP_COUNT = 50;
    const LASER_COUNT = 500;

    // ----------------------------------------------------------------
    // 3. THE COMPUTE SHADER & RENDER SHADER (Unchanged core logic)
    // ----------------------------------------------------------------
    const getComputeShader = (maxInstances: number) => `
        struct IndirectDrawArgs {
            indexCount: u32,
            instanceCount: atomic<u32>, 
            firstIndex: u32,
            baseVertex: u32, 
            firstInstance: u32,
        };

        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera; 
        
        @group(0) @binding(1) var<storage, read> sourceData: array<f32>;
        @group(0) @binding(2) var<storage, read_write> culledData: array<f32>;
        @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

        @compute @workgroup_size(64)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let idx = global_id.x;
            if (idx >= ${maxInstances}u) { return; }

            let _keepCameraAlive = camera.viewProj[0][0];

            let base = idx * 14u;
            let yPos = sourceData[base + 2u]; 

            if (yPos > -500.0) {
                let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
                let writeBase = writeIdx * 14u;

                for(var i = 0u; i < 14u; i = i + 1u) {
                    culledData[writeBase + i] = sourceData[base + i];
                }
            }
        }
    `;

    const renderShaderCode = `
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
            
            let light = max(dot(norm, normalize(vec3<f32>(0.5, 1.0, 0.5))), 0.3);
            out.color = color * light;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    // ----------------------------------------------------------------
    // 4. INDIRECT BATCH CREATION (Bound to scenePass!)
    // ----------------------------------------------------------------
    const createIndirectBatch = (maxInst: number, geometry: any) => {
        const batch = engine.createBatch(scenePass, {  // Bound to Offscreen!
            isIndirect: true,
            computeShaderCode: getComputeShader(maxInst),
            shaderCode: renderShaderCode,
            strideFloats: 14,
            maxInstances: maxInst,
            vertexLayouts: geometry.layout.getWebGPUDescriptor()
        });

        const initialDrawArgs = new Uint32Array([geometry.indices.length, 0, 0, 0, 0]);
        engine.device.queue.writeBuffer(batch.indirectBuffer!, 0, initialDrawArgs);
        engine.setBatchGeometry(batch, geometry.vertexBuffer, geometry.indexBuffer, geometry.indices.length);
        return batch;
    };

    const asteroidBatch = createIndirectBatch(ASTEROID_COUNT, astGeom);
    const shipBatch = createIndirectBatch(SHIP_COUNT, shipGeom);
    const laserBatch = createIndirectBatch(LASER_COUNT, laserGeom);


    // =========================================================
    // 5. POST PROCESSING: TACTICAL HUD SHADER
    // =========================================================
    const hudPass = engine.createPass({
        name: 'Tactical HUD Post Process',
        isMainScreenPass: true // This goes to the canvas!
    });

    const hudShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        // ECS array will hold: [0] = time, [1] = amplitude
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        @group(1) @binding(0) var screenTex: texture_2d<f32>;
        @group(1) @binding(1) var screenSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
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
            let amplitude = ecs[1];

            // 1. Mild Cockpit Glass Distortion
            var viewUV = uv * 2.0 - 1.0; 
            let offset = viewUV.yx / 10.0; // Less extreme than CRT
            viewUV = viewUV + viewUV * offset * offset; 
            viewUV = viewUV * 0.5 + 0.5;

            // 2. Reactive Chromatic Aberration (Splits more as amplitude increases)
            let caIntensity = 0.002 + (amplitude * 0.008);
            let texR = textureSample(screenTex, screenSamp, viewUV + vec2<f32>(caIntensity, 0.0)).r;
            let texG = textureSample(screenTex, screenSamp, viewUV).g;
            let texB = textureSample(screenTex, screenSamp, viewUV - vec2<f32>(caIntensity, 0.0)).b;
            var color = vec3<f32>(texR, texG, texB);

            // Mask out edges if distortion pulled pixels from outside
            let bounds = step(0.0, viewUV.x) * step(viewUV.x, 1.0) * step(0.0, viewUV.y) * step(viewUV.y, 1.0);
            color *= bounds;

            // 3. Tactical Scanlines
            let scanline = sin(viewUV.y * 1200.0) * 0.03;
            color -= scanline;

            // 4. Color Grading: High Contrast & "Cold Space" Filter
            // Crush the blacks, push shadows to blue, blast the highlights (lasers)
            color = pow(color, vec3<f32>(1.2, 1.05, 0.95)); // Cool tint
            color *= 1.4; // Boost overall brightness to make lasers glow

            // 5. Deep Space Vignette
            let vigDistance = length(uv - 0.5);
            let vignette = smoothstep(0.85, 0.25, vigDistance);
            color *= vignette;

            // 6. Camera Feed Noise (Increases with chaos)
            let noiseIntensity = 0.01 + (amplitude * 0.03);
            let noise = fract(sin(dot(viewUV.xy + time, vec2<f32>(12.9898, 78.233))) * 43758.5453);
            color += vec3<f32>(noise * noiseIntensity); 

            return vec4<f32>(color, 1.0);
        }
    `;

    const hudBatch = engine.createBatch(hudPass, {
        shaderCode: hudShader,
        strideFloats: 2, // Passing Time AND Amplitude
        maxInstances: 1,
        vertexLayouts: []
    });

    // Link the Offscreen texture to our post-processing batch
    engine.attachTextureMaterial(hudBatch, offscreenTexture.createView(), sampler);

    // =========================================================
    // 6. INITIALIZE ECS DATA ARRAYS
    // =========================================================
    const asteroidData = new Float32Array(ASTEROID_COUNT * 14);
    const shipData = new Float32Array(SHIP_COUNT * 14);
    const laserData = new Float32Array(LASER_COUNT * 14);
    const postProcessData = new Float32Array(2); // [time, amplitude]

    // Spawn Asteroids
    for (let i = 0; i < ASTEROID_COUNT; i++) {
        const b = i * 14;
        asteroidData[b + 1] = (Math.random() - 0.5) * 200;
        asteroidData[b + 2] = Math.random() * 200;
        asteroidData[b + 3] = (Math.random() - 0.5) * 100;
        asteroidData[b + 8] = asteroidData[b + 9] = asteroidData[b + 10] = Math.random() * 2 + 0.5;
        asteroidData[b + 11] = 0.4; asteroidData[b + 12] = 0.3; asteroidData[b + 13] = 0.3;
    }

    // Spawn Ships
    const shipBaseX = new Float32Array(SHIP_COUNT);
    for (let i = 0; i < SHIP_COUNT; i++) {
        const b = i * 14;
        shipBaseX[i] = (Math.random() - 0.5) * 150;
        shipData[b + 1] = shipBaseX[i];
        shipData[b + 2] = -40;
        shipData[b + 3] = (Math.random() - 0.5) * 20;
        shipData[b + 8] = shipData[b + 9] = shipData[b + 10] = 3.0;
        shipData[b + 11] = 0.1; shipData[b + 12] = 0.5; shipData[b + 13] = 1.0;
    }

    // Spawn Lasers
    for (let i = 0; i < LASER_COUNT; i++) {
        const b = i * 14;
        laserData[b + 2] = -999;
        laserData[b + 8] = laserData[b + 9] = laserData[b + 10] = 1.5;
        laserData[b + 11] = 0.0; laserData[b + 12] = 1.0; laserData[b + 13] = 0.2;
    }

    // =========================================================
    // 7. THE GAME LOOP
    // =========================================================
    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // Asteroids Fall
            for (let i = 0; i < ASTEROID_COUNT; i++) {
                const b = i * 14;
                asteroidData[b + 2] -= 0.5 * uiState.amplitude;
                if (asteroidData[b + 2] < -60) {
                    asteroidData[b + 2] = 100;
                    asteroidData[b + 1] = (Math.random() - 0.5) * 200;
                }
            }

            // Ships Dodge
            for (let i = 0; i < SHIP_COUNT; i++) {
                const b = i * 14;
                shipData[b + 1] = shipBaseX[i] + Math.sin(simTime * 2.0 + i) * 15 * uiState.amplitude;
            }

            // Lasers Shoot
            for (let i = 0; i < LASER_COUNT; i++) {
                const b = i * 14;
                if (laserData[b + 2] > -500) {
                    laserData[b + 2] += 2.0 * uiState.amplitude;
                }
                if (laserData[b + 2] > 100 || (laserData[b + 2] < -500 && Math.random() < 0.01)) {
                    const randomShipIndex = Math.floor(Math.random() * SHIP_COUNT);
                    const shipBase = randomShipIndex * 14;
                    laserData[b + 1] = shipData[shipBase + 1];
                    laserData[b + 2] = shipData[shipBase + 2];
                    laserData[b + 3] = shipData[shipBase + 3];
                }
            }

            // Update 3D Scene
            engine.updateBatchData(asteroidBatch, asteroidData, ASTEROID_COUNT);
            engine.updateBatchData(shipBatch, shipData, SHIP_COUNT);
            engine.updateBatchData(laserBatch, laserData, LASER_COUNT);

            // Update Post-Processing Uniforms (Time & Amplitude)
            postProcessData[0] = simTime;
            postProcessData[1] = uiState.amplitude;
            engine.updateBatchData(hudBatch, postProcessData, 1);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}