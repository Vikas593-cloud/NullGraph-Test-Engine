// demos/WebGPUExperiments/IridescentLeviathan/index.ts
import { NullGraph, Camera } from 'null-graph';
import { pyramidIndices, pyramidVertices } from "../../../data";
import { leviathanComputeShader, leviathanRenderShader } from "./shaders";
import { refractionPostProcessShader } from "./postProcessShaders";
import { UIState } from "../../../ui";

export async function setupIridescentLeviathan(engine: NullGraph, camera: Camera, getState: () => UIState) {
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
    });

    const scenePass = engine.createPass({
        name: 'Leviathan Geometry Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, // MUST be zero for normal-mapping to work
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: leviathanComputeShader,
        shaderCode: leviathanRenderShader,
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
        name: 'Glass Refraction Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: refractionPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Initial Data: Spawn in a tight sphere. The fluid dynamics will unpack them.
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        initialData[base + 1] = (Math.random() - 0.5) * 40;
        initialData[base + 2] = (Math.random() - 0.5) * 40;
        initialData[base + 3] = (Math.random() - 0.5) * 40;
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
            // A steady, slow orbit to let the fluid motion shine
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * 120,
                0,
                Math.cos(time * 0.1) * 120
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