// demos/WebGPUExperiments/QuantumNebula/index.ts
import { NullGraph, Camera } from 'null-graph';
import { nebulaComputeShader, nebulaRenderShader } from "./shaders";
import { hologramPostProcessShader } from "./postProcessShaders";
import { UIState } from "../../../types";
import { Primitives, StandardLayout } from "null-graph/geometry";

export async function setupQuantumNebula(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 200000; // Let's push it even higher!
    const STRIDE = 14;

    // Using cubes for the particles
    const cubeGeom = Primitives.createCube(StandardLayout, 2, 2, 2);
    cubeGeom.upload(engine);

    // --- 1. RENDER TARGETS ---
    const offscreenTexture = engine.device.createTexture({
        size: [2048, 2048],
        format: 'rgba16float',
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

    // --- 2. MAIN SCENE PASS ---
    const scenePass = engine.createPass({
        name: 'Nebula Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Pure black for additive blending
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    // --- NEW BATCH API IN ACTION ---
    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: nebulaComputeShader,
        shaderCode: nebulaRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor(),

        // ADDITIVE BLENDING: Colors sum together, creating intense glowing cores
        blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
        },
        depthWriteEnabled: false,
        depthCompare: 'less'
    });

    const initialDrawArgs = new Uint32Array([cubeGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(physicsBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        physicsBatch,
        cubeGeom.vertexBuffer!,
        cubeGeom.indexBuffer!,
        cubeGeom.indices.length
    );

    // --- 3. POST PROCESS PASS (HOLOGRAM / CHROMATIC ABERRATION) ---
    const postPass = engine.createPass({
        name: 'Nebula Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: hologramPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- 4. INITIALIZATION ---
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Spawn particles in a wide disk (galaxy shape)
        const radius = Math.random() * 500 + 10;
        const angle = Math.random() * Math.PI * 2;

        initialData[base + 1] = Math.cos(angle) * radius; // x
        initialData[base + 2] = (Math.random() - 0.5) * 10; // y (thin disk)
        initialData[base + 3] = Math.sin(angle) * radius; // z

        // Initial Velocity (orbiting)
        initialData[base + 4] = -Math.sin(angle) * 50;
        initialData[base + 5] = 0;
        initialData[base + 6] = Math.cos(angle) * 50;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);

            // Note: If your compute shader uses atomicAdd for instance counts,
            // you might need to clear the indirect buffer instance count here
            // depending on how null-graph handles per-frame indirect resets!
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Sweeping galaxy view
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * 250,
                150 + Math.sin(time * 0.05) * 50,
                Math.cos(time * 0.1) * 250
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}