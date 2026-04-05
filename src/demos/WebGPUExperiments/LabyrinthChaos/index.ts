// demos/WebGPUExperiments/LabyrinthChaos/index.ts
import { NullGraph, Camera } from 'null-graph';
import { labyrinthComputeShader, labyrinthRenderShader } from "./shaders";
import { cherenkovAnamorphicPostProcess } from "./postProcessShaders";
import { UIState } from "../../../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupLabyrinthChaos(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 200000;
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
        name: 'Labyrinth Chaos Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.005, g: 0.005, b: 0.01, a: 1.0 }, // Deep space blue/black
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: labyrinthComputeShader,
        shaderCode: labyrinthRenderShader,
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
        name: 'Cherenkov Anamorphic Post Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: cherenkovAnamorphicPostProcess,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // Initial Data: A tight quantum sphere that will explode into the lattice
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Spherical distribution
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * 5.0; // Very tight initial core

        initialData[base + 1] = r * Math.sin(phi) * Math.cos(theta);
        initialData[base + 2] = r * Math.sin(phi) * Math.sin(theta);
        initialData[base + 3] = r * Math.cos(phi);

        // Explosive outward velocity
        initialData[base + 4] = (initialData[base + 1] / r) * 15;
        initialData[base + 5] = (initialData[base + 2] / r) * 15;
        initialData[base + 6] = (initialData[base + 3] / r) * 15;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    let mouseX = 0; let mouseY = 0; let isMouseDown = 0;
    const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
    };
    const onMouseDown = () => isMouseDown = 1.0;
    const onMouseUp = () => isMouseDown = 0.0;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime*0.0001;
            // Hijack camera unused bytes for mouse mapping and click state
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;
            camera.bufferData[18] = isMouseDown; // Use to trigger "Gravity Well"

            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Pushed back to 220 radius with a higher vantage point
            const eye: [number, number, number] = [
                Math.sin(time * 0.05) * 220,
                Math.cos(time * 0.03) * 100,
                Math.cos(time * 0.05) * 220
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}