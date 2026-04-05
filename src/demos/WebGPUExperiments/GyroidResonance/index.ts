// demos/WebGPUExperiments/GyroidResonance/index.ts
import { NullGraph, Camera } from 'null-graph';
import { gyroidComputeShader, gyroidRenderShader } from "./shaders";
import { halationScatteringPostProcess } from "./postProcessShaders";
import { UIState } from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupGyroidResonance(engine: NullGraph, camera: Camera, getState: () => UIState) {
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
        name: 'Gyroid Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.002, g: 0.001, b: 0.005, a: 1.0 }, // Void purple-black
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
        name: 'Halation Scattering Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: halationScatteringPostProcess,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Initial Data: Spawn in a massive Torus so they aggressively collapse into the Gyroid
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + (Math.random() - 0.5) * 40;
        const height = (Math.random() - 0.5) * 40;

        initialData[base + 1] = Math.cos(angle) * radius;
        initialData[base + 2] = height;
        initialData[base + 3] = Math.sin(angle) * radius;

        // Tangent velocity for a swirling start
        initialData[base + 4] = -Math.sin(angle) * 20;
        initialData[base + 5] = (Math.random() - 0.5) * 10;
        initialData[base + 6] = Math.cos(angle) * 20;
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
            // Hijack camera unused bytes for mouse mapping
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;

            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Slow, cinematic orbit
            const eye: [number, number, number] = [
                Math.sin(time * 0.15) * 160,
                40 + Math.sin(time * 0.1) * 30,
                Math.cos(time * 0.15) * 160
            ];
            cam.updateView(eye, [0, 0, 0]);
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