// demos/WebGPUExperiments/AizawaCanvas/index.ts
import { NullGraph, Camera } from 'null-graph';
import { aizawaComputeShader, aizawaRenderShader } from "./shaders";
import { kuwaharaPostProcessShader } from "./postProcessShaders";
import { UIState } from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupAizawaCanvas(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 150000;
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
        name: 'Aizawa Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 }, // Dark slate canvas
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: aizawaComputeShader,
        shaderCode: aizawaRenderShader,
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
        name: 'Kuwahara Painterly Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: kuwaharaPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Initial Data: Spawn in a tight central cluster
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        initialData[base + 1] = (Math.random() - 0.5) * 10;
        initialData[base + 2] = (Math.random() - 0.5) * 10;
        initialData[base + 3] = (Math.random() - 0.5) * 10;
        // Zero initial velocity; the attractor takes over immediately
        initialData[base + 4] = 0;
        initialData[base + 5] = 0;
        initialData[base + 6] = 0;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    let mouseX = 0; let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
    };
    window.addEventListener('mousemove', onMouseMove);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;
            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Keep the camera slightly elevated to look down into the "apple" shape of the attractor
            const eye: [number, number, number] = [
                Math.sin(time * 0.2) * 50,
                30 + Math.cos(time * 0.1) * 10,
                Math.cos(time * 0.2) * 50
            ];
            cam.updateView(eye, [0, 5, 0]);
        },
        destroy: () => {
            window.removeEventListener('mousemove', onMouseMove);
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}