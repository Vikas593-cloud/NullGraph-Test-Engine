// demos/BloomEffectExample.ts
import { NullGraph, Camera } from 'null-graph';
import {UIState} from "../types";
import {PositionOnlyLayout, Primitives, StandardLayout} from "null-graph/geometry";

export async function setupBloomEffect(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 50;
    const STRIDE = 14;
    const TEX_SIZE = 1024; // High-res target for crispness

    // =========================================================
    // 1. OFFSCREEN TEXTURES (We need TWO now!)
    // =========================================================
    const sceneTexture = engine.device.createTexture({
        size: [TEX_SIZE, TEX_SIZE], format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const sceneDepth = engine.device.createTexture({
        size: [TEX_SIZE, TEX_SIZE], format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // This texture will only hold the blurry, glowing parts!
    const bloomTexture = engine.device.createTexture({
        size: [TEX_SIZE, TEX_SIZE], format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const sampler = engine.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const cubeGeom=Primitives.createCube(PositionOnlyLayout,1.0,1.0,1.0)

    cubeGeom.upload(engine)

    // =========================================================
    // PASS 1: THE 3D SCENE (Draws to sceneTexture)
    // =========================================================
    const scenePass = engine.createPass({
        name: 'Scene Pass', isMainScreenPass: false,
        colorAttachments: [{
            view: sceneTexture.createView(),
            clearValue: { r: 0.01, g: 0.01, b: 0.02, a: 1.0 }, // Almost pitch black space
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: sceneDepth.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const sceneShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            var pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            out.color = color;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0); // Unlit shader so neon colors POP!
        }
    `;

    const sceneBatch = engine.createBatch(scenePass, {
        shaderCode: sceneShader, strideFloats: STRIDE, maxInstances: MAX_INSTANCES,
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    });
    engine.setBatchGeometry(sceneBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    // =========================================================
    // PASS 2: THE BLOOM EXTRACTION & BLUR (Draws to bloomTexture)
    // =========================================================
    const bloomPass = engine.createPass({
        name: 'Bloom Pass', isMainScreenPass: false,
        colorAttachments: [{
            view: bloomTexture.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear', storeOp: 'store'
        }]
    });

    const bloomShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        @group(1) @binding(0) var sceneTex: texture_2d<f32>;
        @group(1) @binding(1) var samp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
            let _keepCameraAlive = camera.viewProj[0][0]; // Prevent compiler crash!
            let _keepEcsAlive = ecs[0];
            var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
            var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
            var out: VertexOut;
            out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
            out.uv = uv[vIdx];
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            var bloom = vec3<f32>(0.0);
            let spread = 3.0 / 1024.0; // How far the glow reaches

            // A simple 25-sample box blur
            for(var x: i32 = -2; x <= 2; x++) {
                for(var y: i32 = -2; y <= 2; y++) {
                    let offset = vec2<f32>(f32(x), f32(y)) * spread;
                    let sampleColor = textureSample(sceneTex, samp, uv + offset).rgb;
                    
                    // Is it bright enough to glow? (Luminance check)
                    let brightness = dot(sampleColor, vec3<f32>(0.2126, 0.7152, 0.0722));
                    if (brightness > 0.8) { 
                        bloom += sampleColor; 
                    }
                }
            }
            // Average it out and boost the intensity!
            return vec4<f32>(bloom / 15.0, 1.0); 
        }
    `;

    const bloomBatch = engine.createBatch(bloomPass, { shaderCode: bloomShader, strideFloats: 1, maxInstances: 1 });
    engine.attachTextureMaterial(bloomBatch, sceneTexture.createView(), sampler);

    // =========================================================
    // PASS 3: THE COMPOSITE (Draws to Main Screen)
    // =========================================================
    const compositePass = engine.createPass({ name: 'Composite Pass', isMainScreenPass: true });

    const compositeShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        // WE ARE BINDING TWO TEXTURES HERE!
        @group(1) @binding(0) var sceneTex: texture_2d<f32>;
        @group(1) @binding(1) var sceneSamp: sampler;
        @group(1) @binding(2) var bloomTex: texture_2d<f32>;
        @group(1) @binding(3) var bloomSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
            let _keepCameraAlive = camera.viewProj[0][0]; 
            let _keepEcsAlive = ecs[0];
            var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
            var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
            var out: VertexOut;
            out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
            out.uv = uv[vIdx];
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            let baseColor = textureSample(sceneTex, sceneSamp, uv).rgb;
            let glowColor = textureSample(bloomTex, bloomSamp, uv).rgb;
            
            // The Magic: Additive Blending
            return vec4<f32>(baseColor + glowColor, 1.0);
        }
    `;

    const compositeBatch = engine.createBatch(compositePass, { shaderCode: compositeShader, strideFloats: 1, maxInstances: 1 });

    // Using your custom bind group method to pass both textures!
    engine.attachCustomBindGroup(compositeBatch, [
        { binding: 0, resource: sceneTexture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: bloomTexture.createView() },
        { binding: 3, resource: sampler }
    ]);

    // =========================================================
    // DATA & ANIMATION
    // =========================================================
    const data = new Float32Array(MAX_INSTANCES * STRIDE);

    // The "Sun" (Instance 0)
    data[8] = 20.0; data[9] = 20.0; data[10] = 20.0; // Massive scale
    data[11] = 1.0; data[12] = 0.9; data[13] = 0.2;  // Super bright neon yellow

    // The "Planets" (Instances 1 to 49)
    for (let i = 1; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        data[base + 8] = 2.0; data[base + 9] = 2.0; data[base + 10] = 2.0;
        // Make them dark so they DO NOT glow
        data[base + 11] = 0.1; data[base + 12] = 0.1; data[base + 13] = 0.3;
    }

    const dummyData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            // Orbit the planets around the sun
            for (let i = 1; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;
                const radius = 30.0 + (i * 1.5);
                const speed = simTime * (0.5 + (i * 0.02));
                data[base + 1] = Math.sin(speed) * radius; // X
                data[base + 2] = Math.sin(speed * 0.5) * 10.0; // Y (wobble)
                data[base + 3] = Math.cos(speed) * radius; // Z
            }

            engine.updateBatchData(sceneBatch, data, MAX_INSTANCES);
            engine.updateBatchData(bloomBatch, dummyData, 1);
            engine.updateBatchData(compositeBatch, dummyData, 1);
        },
        destroy: () => {
            sceneTexture.destroy(); sceneDepth.destroy(); bloomTexture.destroy();
            engine.clearPasses();
        }
    };
}