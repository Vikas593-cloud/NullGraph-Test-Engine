// demos/WebGPUExperiments/Singularity/index.ts
import { NullGraph, Camera } from 'null-graph';
import { singularityComputeShader, singularityRenderShader } from "./shaders";
import { godRaysPostProcessShader } from "../QuantumCore/shaders";
import {UIState} from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupSingularity(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 100000;
    const STRIDE = 14;

    // --- 1. POST PROCESS SETUP ---
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

    // --- 2. SCENE PASS ---
    const scenePass = engine.createPass({
        name: 'Singularity Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.005, g: 0.0, b: 0.01, a: 1.0 },
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: singularityComputeShader,
        shaderCode: singularityRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: [{
            arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
    });

    const pyramidGeom=Primitives.createPyramid(StandardLayout,1.0,1.0,1.0)
    pyramidGeom.upload(engine)
    // Seed Indirect Buffer with index count
    const initialDrawArgs = new Uint32Array([pyramidGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(physicsBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        physicsBatch,
        pyramidGeom.vertexBuffer!,
        pyramidGeom.indexBuffer!,
        pyramidGeom.indices.length
    );

    // --- 4. POST PROCESS PASS ---
    const postPass = engine.createPass({
        name: 'Singularity Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: godRaysPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- 5. INITIAL CPU SEEDING ---
    // We only upload this data ONCE. The GPU takes over completely after this.
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        // Spawn them in a massive sphere
        const r = Math.random() * 150 + 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        initialData[base + 1] = r * Math.sin(phi) * Math.cos(theta); // Pos X
        initialData[base + 2] = (Math.random() - 0.5) * 20;          // Pos Y (flattened disk)
        initialData[base + 3] = r * Math.sin(phi) * Math.sin(theta); // Pos Z

        // Give them a slight initial tangential velocity
        initialData[base + 4] = -initialData[base + 3] * 0.1; // Vel X
        initialData[base + 5] = 0;                            // Vel Y
        initialData[base + 6] = initialData[base + 1] * 0.1;  // Vel Z
    }

    // Upload to the Source buffer (which our Compute shader reads AND writes to)
    // This properly seeds the GPU memory AND tells NullGraph we have 100,000 particles!
    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);

    const postProcessTimeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            // WE NO LONGER UPDATE THE MASSIVE ARRAY ON THE CPU!
            // We just send the single time float to the GPU.
            camera.bufferData[19] = simTime;

            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Cinematic sweeping camera to watch the black hole
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * 250,
                80 + Math.sin(time * 0.05) * 50,
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