// demos/WebGPUExperiments/EtherealGyroid/index.ts
import { NullGraph, Camera } from 'null-graph';
import { gyroidComputeShader, gyroidRenderShader } from "./shaders";
import { chromaticAberrationPostProcess } from "./postProcessShaders";
import { UIState } from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupEtherealGyroid(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 150000; // Let's crank it. TPMS surfaces need density to look good!
    const STRIDE = 14;

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
        name: 'Gyroid Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.005, g: 0.0, b: 0.01, a: 1.0 }, // Deep void purple
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: gyroidComputeShader,
        shaderCode: gyroidRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: [{
            arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
    });
    const pyramidGeom=Primitives.createPyramid(StandardLayout,1.0,1.0,1.0)
    pyramidGeom.upload(engine)

    const initialDrawArgs = new Uint32Array([pyramidGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(physicsBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        physicsBatch,
        pyramidGeom.vertexBuffer!,
        pyramidGeom.indexBuffer!,
        pyramidGeom.indices.length
    );

    const postPass = engine.createPass({
        name: 'Gyroid Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: chromaticAberrationPostProcess, // Swapped to a new post-process!
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Scatter particles randomly in a massive volume so they can "find" the invisible surface
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        initialData[base + 1] = (Math.random() - 0.5) * 300;
        initialData[base + 2] = (Math.random() - 0.5) * 300;
        initialData[base + 3] = (Math.random() - 0.5) * 300;

        // Zero initial velocity
        initialData[base + 4] = 0; initialData[base + 5] = 0; initialData[base + 6] = 0;
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
            // Slow, majestic fly-through of the labyrinth
            const eye: [number, number, number] = [
                Math.sin(time * 0.05) * 120,
                Math.cos(time * 0.03) * 120,
                Math.sin(time * 0.04) * 120
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy(); offscreenDepth.destroy(); engine.clearPasses();
        }
    };
}