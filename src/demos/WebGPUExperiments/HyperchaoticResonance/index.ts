import { NullGraph, Camera } from 'null-graph';
import { pyramidIndices, pyramidVertices } from "../../../data";
import { hyperchaosComputeShader, hyperchaosRenderShader } from "./shaders";
import { anamorphicDispersionPostProcess } from "./postProcessShaders";
import { UIState } from "../../../ui";

export async function setupHyperchaoticResonance(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 200000; // Increased particle count for dense ribbons
    const STRIDE = 16; // We need 16 floats to comfortably store 4D vectors and alignment

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

    const scenePass = engine.createPass({
        name: 'Hyperchaos Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.005, g: 0.008, b: 0.012, a: 1.0 }, // Deep abyssal teal/black
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: hyperchaosComputeShader,
        shaderCode: hyperchaosRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: [{
            arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
    });

    const initialDrawArgs = new Uint32Array([pyramidIndices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(physicsBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        physicsBatch,
        engine.bufferManager.createVertexBuffer(pyramidVertices),
        engine.bufferManager.createIndexBuffer(pyramidIndices),
        pyramidIndices.length
    );

    const postPass = engine.createPass({
        name: 'Anamorphic Dispersion Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: anamorphicDispersionPostProcess,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Initial Data: Spawn in a tight 4D hyper-sphere
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Random points in 4D space (-10 to 10)
        initialData[base + 1] = (Math.random() - 0.5) * 20; // x
        initialData[base + 2] = (Math.random() - 0.5) * 20; // y
        initialData[base + 3] = (Math.random() - 0.5) * 20; // z
        initialData[base + 4] = (Math.random() - 0.5) * 20; // w (The 4th dimension)

        // Give them a slight velocity offset to kickstart the chaos
        initialData[base + 5] = Math.random() * 0.1;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Camera tracks the center but bobs slightly as if observing through a telescope
            const eye: [number, number, number] = [
                Math.sin(time * 0.05) * 250,
                80 + Math.cos(time * 0.08) * 40,
                Math.cos(time * 0.05) * 250
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