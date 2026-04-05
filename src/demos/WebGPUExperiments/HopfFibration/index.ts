// demos/WebGPUExperiments/HopfFibration/index.ts
import { NullGraph, Camera } from 'null-graph';
import { hopfComputeShader, hopfRenderShader } from "./shaders";
import { anamorphicPostProcessShader } from "./postProcessShaders";
import { UIState } from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupHopfFibration(engine: NullGraph, camera: Camera, getState: () => UIState) {
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
        name: 'Hopf 4D Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Pure pitch black
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const mathBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: hopfComputeShader,
        shaderCode: hopfRenderShader,
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
    engine.device.queue.writeBuffer(mathBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        mathBatch,
        pyramidGeom.vertexBuffer!,
       pyramidGeom.indexBuffer!,
        pyramidGeom.indices.length
    );

    const postPass = engine.createPass({
        name: 'Anamorphic Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: anamorphicPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- INITIALIZATION: 4D Parametric Angles ---
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // eta: determines which torus the particle belongs to (0 to PI/2)
        // xi1, xi2: determines the position along the fibers of that torus (0 to 2PI)
        const eta = Math.acos(Math.sqrt(Math.random())); // Weighted distribution
        const xi1 = Math.random() * Math.PI * 2;
        const xi2 = Math.random() * Math.PI * 2;

        initialData[base + 1] = eta;
        initialData[base + 2] = xi1;
        initialData[base + 3] = xi2;

        // We'll use slot 4,5,6 for the *previous* 3D position to calculate drawing stretch
        initialData[base + 4] = 0;
        initialData[base + 5] = 0;
        initialData[base + 6] = 0;
    }

    engine.updateBatchData(mathBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    // --- MOUSE: 4D Rotation Control ---
    let mouseX = 0; let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
    };
    window.addEventListener('mousemove', onMouseMove);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = 0.0;
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;

            postProcessTimeData[0] = 0.0;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Keep the camera relatively still so we can appreciate the 4D folding
            const eye: [number, number, number] = [
                Math.sin(0.0 ) * 40,
                30,
                Math.cos(0.0 ) * 40
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