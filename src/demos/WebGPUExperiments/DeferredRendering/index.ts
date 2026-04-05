import { NullGraph, Camera } from 'null-graph';
import {  gBufferRenderShader } from "./gBufferShaders";
import { deferredLightingShader } from "./deferredShaders";
import { halationScatteringPostProcess } from "./postProcessShaders";
import { Primitives, CompleteLayout } from "null-graph/geometry";

export async function setupDeferredRendering(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 5000;
    const STRIDE = 14;

    const cubeGeom = Primitives.createCube(CompleteLayout, 2, 2, 2);
    cubeGeom.upload(engine);

    // --- 1. RENDER TARGETS ---
    const resolution = [2048, 2048];
    const albedoTexture = engine.device.createTexture({ size: resolution, format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const normalTexture = engine.device.createTexture({ size: resolution, format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const positionTexture = engine.device.createTexture({ size: resolution, format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const depthTexture = engine.device.createTexture({ size: resolution, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });

    // The HDR output for our lights before post-processing
    const lightingOutputTexture = engine.device.createTexture({ size: resolution, format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

    const sampler = engine.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // --- 2. G-BUFFER PASS (GEOMETRY) ---
    const gBufferPass = engine.createPass({
        name: 'G-Buffer Pass',
        isMainScreenPass: false,
        colorAttachments: [
            { view: albedoTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
            { view: normalTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
            { view: positionTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }
        ],
        depthStencilAttachment: { view: depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });

    const geometryBatch = engine.createBatch(gBufferPass, {
        shaderCode: gBufferRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormats: ['rgba8unorm', 'rgba16float', 'rgba16float'],
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true,
        depthCompare: 'less'
    });
    engine.setBatchGeometry(geometryBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    // --- 3. DEFERRED LIGHTING PASS ---
    const lightingPass = engine.createPass({
        name: 'Lighting Pass',
        isMainScreenPass: false,
        colorAttachments: [{ view: lightingOutputTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });

    const lightingBatch = engine.createBatch(lightingPass, {
        shaderCode: deferredLightingShader, strideFloats: 1, maxInstances: 1, targetFormat: 'rgba16float'
    });
    engine.attachTextureMaterial(lightingBatch, [albedoTexture.createView(), normalTexture.createView(), positionTexture.createView()], sampler);



    // --- 4. POST PROCESS PASS ---
    const postPass = engine.createPass({ name: 'Post Process', isMainScreenPass: true });
    const postBatch = engine.createBatch(postPass, { shaderCode: halationScatteringPostProcess, strideFloats: 1, maxInstances: 1 });
    engine.attachTextureMaterial(postBatch, lightingOutputTexture.createView(), sampler);

    // --- 5. INITIALIZATION & ANIMATION DATA ---
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    const originalYPositions = new Float32Array(MAX_INSTANCES); // Keep track of base heights

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        const startY = (Math.random() - 0.5) * 50;

        initialData[base + 1] = (Math.random() - 0.5) * 200; // x
        initialData[base + 2] = startY;                      // y
        initialData[base + 3] = (Math.random() - 0.5) * 200; // z

        originalYPositions[i] = startY; // Store original Y for the wave math

        // Colors
        initialData[base + 11] = Math.random() * 0.8 + 0.2;
        initialData[base + 12] = Math.random() * 0.8 + 0.2;
        initialData[base + 13] = Math.random() * 0.8 + 0.2;
    }

    engine.updateBatchData(geometryBatch, initialData, MAX_INSTANCES);
    const timeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
            timeData[0] = simTime;
            const uiState = getUiState(); // Grab UI amplitude

            // 1. UPDATE POST-PROCESS / LIGHTING TIME
            engine.updateBatchData(lightingBatch, timeData, 1);
            engine.updateBatchData(postBatch, timeData, 1);

            // 2. CPU ANIMATION LOOP (The Magic)
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;
                const xPos = initialData[base + 1];

                // Calculate the wave offset based on Time + X Position
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;

                // Update the Y position
                initialData[base + 2] = originalYPositions[i] + waveOffset;
            }

            // 3. STREAM NEW POSITIONS TO GPU
            engine.updateBatchData(geometryBatch, initialData, MAX_INSTANCES);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye: [number, number, number] = [ Math.sin(time * 0.2) * 150, 80, Math.cos(time * 0.2) * 150 ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            albedoTexture.destroy(); normalTexture.destroy(); positionTexture.destroy();
            depthTexture.destroy(); lightingOutputTexture.destroy();
            engine.clearPasses();
        }
    };
}