import { NullGraph, Camera } from 'null-graph';
import { UIState } from "../../../types";
import { Primitives, StandardLayout } from "null-graph/geometry";
import { cymaticComputeShader, sandRenderShader, plateRenderShader } from "./shaders";
import { acousticBloomShader } from "./postProcessShaders"; // NEW

export async function setupCymaticResonance(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_SAND = 100000;
    const STRIDE = 14;

    // --- FIX: Get screen dimensions directly ---
    const width = window.innerWidth;
    const height = window.innerHeight;

    const sandGeom = Primitives.createIcosahedron(StandardLayout, 0.08);
    sandGeom.upload(engine);

    const plateGeom = Primitives.createCube(StandardLayout, 100.0, 1.0, 100.0);
    plateGeom.upload(engine);

    // --- 1. RENDER TARGETS (For Post Processing) ---
    const offscreenTexture = engine.device.createTexture({
        size: [width, height],
        format: 'rgba16float', // HDR format is critical for bloom!
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const offscreenDepth = engine.device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const sampler = engine.device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
    });

    // --- 2. MAIN SCENE PASS (Now renders offscreen) ---
    const mainPass = engine.createPass({
        name: 'Cymatics Main Pass',
        isMainScreenPass: false, // Changed from true
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.02, g: 0.02, b: 0.03, a: 1.0 },
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        },

    });

    // --- 3. BATCH 1: THE PLATE ---
    const plateBatch = engine.createBatch(mainPass, {
        shaderCode: plateRenderShader,
        strideFloats: 1,
        maxInstances: 1,
        vertexLayouts: plateGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true,
        targetFormat: 'rgba16float'
    });
    engine.setBatchGeometry(plateBatch, plateGeom.vertexBuffer!, plateGeom.indexBuffer!, plateGeom.indices.length);
    engine.updateBatchData(plateBatch, new Float32Array([0]), 1);

    // --- 4. BATCH 2: THE SAND ---
    const sandBatch = engine.createBatch(mainPass, {
        isIndirect: true,
        computeShaderCode: cymaticComputeShader,
        shaderCode: sandRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_SAND,
        vertexLayouts: sandGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true,
        targetFormat: 'rgba16float'
    });

    const initialDrawArgs = new Uint32Array([sandGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(sandBatch.indirectBuffer!, 0, initialDrawArgs);
    engine.setBatchGeometry(sandBatch, sandGeom.vertexBuffer!, sandGeom.indexBuffer!, sandGeom.indices.length);

    // --- 5. POST PROCESS PASS ---
    const postPass = engine.createPass({
        name: 'Acoustic Bloom Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: acousticBloomShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- 6. INITIALIZE SAND POSITIONS ---
    const initialData = new Float32Array(MAX_SAND * STRIDE);
    for (let i = 0; i < MAX_SAND; i++) {
        const base = i * STRIDE;
        initialData[base + 1] = (Math.random() - 0.5) * 98.0;
        initialData[base + 2] = Math.random() * 40.0 + 5.0;
        initialData[base + 3] = (Math.random() - 0.5) * 98.0;
        initialData[base + 4] = 0; initialData[base + 5] = 0; initialData[base + 6] = 0;
    }
    engine.updateBatchData(sandBatch, initialData, MAX_SAND);

    const postProcessTimeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime*1;

            // Send time to post process shader for animated effects
            postProcessTimeData[0] = simTime*1;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * 90,
                70,
                Math.cos(time * 0.1) * 90
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}