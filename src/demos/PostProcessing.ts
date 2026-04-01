// demos/SimpleMultiPassExample.ts
import { NullGraph, Camera } from 'null-graph';
import {cubeIndices, cubeVertices, cubeVerticesWithUV} from "../data";

export async function setupPostProcessing(engine: NullGraph, camera: Camera,getUiState: () => { amplitude: number }) {
    const STRIDE = 14;

    // =========================================================
    // 1. OFFSCREEN TEXTURES (The Camera Film)
    // =========================================================
    const texSize = 512;
    const offscreenTexture = engine.device.createTexture({
        size: [texSize, texSize],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const offscreenDepth = engine.device.createTexture({
        size: [texSize, texSize],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const sampler = engine.device.createSampler({
        magFilter: 'linear', minFilter: 'linear'
    });

    const vbo = engine.bufferManager.createVertexBuffer(cubeVerticesWithUV);
    const ibo = engine.bufferManager.createIndexBuffer(cubeIndices);

    // =========================================================
    // PASS 1: THE SCENE (Draws to the offscreen texture)
    // =========================================================
    const pass1 = engine.createPass({
        name: 'Offscreen Security Camera',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.3, g: 0.0, b: 0.0, a: 1.0 }, // Dark Red background so we can easily spot it!
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const shader1 = `
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
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            out.color = vec3<f32>(1.0, 1.0, 0.0); // Make the inner cube bright yellow
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    const batch1 = engine.createBatch(pass1, {
        shaderCode: shader1,
        strideFloats: STRIDE, maxInstances: 1,
        vertexLayouts: [{
            arrayStride: 32, attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
                { shaderLocation: 1, offset: 12, format: 'float32x3' }, // Normal/Color (Ignored in this shader)
                { shaderLocation: 2, offset: 24, format: 'float32x2' } // U V
            ]
        }]
    });
    engine.setBatchGeometry(batch1, vbo, ibo, cubeIndices.length);

    // =========================================================
    // PASS 2: THE TV MONITOR (Draws to the Main Screen)
    // =========================================================
    const pass2 = engine.createPass({
        name: 'Main Screen Monitor',
        isMainScreenPass: true
    });

    const shader2 = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        // Grab the texture from Pass 1!
        @group(1) @binding(0) var screenTex: texture_2d<f32>;
        @group(1) @binding(1) var screenSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>,@location(1) localNormal:vec3<f32>,@location(2) localUV:vec2<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            
            out.uv = localUV;
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            // Paint the texture onto the cube
            return textureSample(screenTex, screenSamp, uv);
        }
    `;

    const batch2 = engine.createBatch(pass2, {
        shaderCode: shader2,
        strideFloats: STRIDE, maxInstances: 1,
        vertexLayouts: [{
            arrayStride: 32, attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
                { shaderLocation: 2, offset: 24, format: 'float32x2' },
            ]
        }]
    });
    engine.setBatchGeometry(batch2, vbo, ibo, cubeIndices.length);

    // Wire Pass 1's texture into Pass 2's batch
    engine.attachTextureMaterial(batch2, offscreenTexture.createView(), sampler);

    // =========================================================
    // DATA & ANIMATION
    // =========================================================
    // =========================================================
    // DATA & ANIMATION (Scaled up for a zoomed-out camera!)
    // =========================================================
    const data1 = new Float32Array(STRIDE);
    // Make the inner yellow cube massive (15x) so it shows up on the texture
    data1[8] = 15.0; data1[9] = 15.0; data1[10] = 15.0;

    const data2 = new Float32Array(STRIDE);
    // Make the TV Monitor absolutely gigantic (60x)
    data2[8] = 60.0; data2[9] = 60.0; data2[10] = 60.0;
    data2[2] = -15.0; // Push it down so we can see the top face better

    return {
        update: (simTime: number) => {
            // Widen the orbit of the yellow cube so it sweeps across the texture
            data1[1] = Math.sin(simTime * 2.0) * 20.0;
            data1[2] = Math.cos(simTime * 2.0) * 20.0;
            engine.updateBatchData(batch1, data1, 1);

            // Make the TV Monitor sweep wildly across the main screen
            data2[1] = Math.sin(simTime * 0.5) * 40.0;
            engine.updateBatchData(batch2, data2, 1);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}