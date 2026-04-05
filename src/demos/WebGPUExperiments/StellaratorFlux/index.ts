// demos/WebGPUExperiments/StellaratorFlux/index.ts
import { NullGraph, Camera } from 'null-graph';
import { stellarComputeShader, stellarRenderShader } from "./shaders";
import { UIState } from "../../../types";
import {bokehBloomPostProcessShader} from "../AetherialFlow/postProcessShaders";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupStellaratorFlux(engine: NullGraph, camera: Camera, getState: () => UIState) {
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
        name: 'Stellarator Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.000, g: 0.001, b: 0.005, a: 1.0 }, // Deep void
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: stellarComputeShader,
        shaderCode: stellarRenderShader,
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
        name: 'Stellarator Post Process',
        isMainScreenPass: true
    });

    // Reusing your excellent Bokeh/Bloom shader
    const postBatch = engine.createBatch(postPass, {
        shaderCode: bokehBloomPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- INITIALIZATION: Toroidal Spawning ---
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Spawn particles inside a mathematical Torus
        const u = Math.random() * Math.PI * 2; // Toroidal angle
        const v = Math.random() * Math.PI * 2; // Poloidal angle
        const majorR = 80.0;
        const minorR = 30.0 * Math.sqrt(Math.random()); // Volume distribution

        const x = (majorR + minorR * Math.cos(v)) * Math.cos(u);
        const y = minorR * Math.sin(v);
        const z = (majorR + minorR * Math.cos(v)) * Math.sin(u);

        initialData[base + 1] = x;
        initialData[base + 2] = y;
        initialData[base + 3] = z;

        // Give them an initial kick along the toroidal axis so they don't start frozen
        initialData[base + 4] = -Math.sin(u) * 50;
        initialData[base + 5] = 0;
        initialData[base + 6] = Math.cos(u) * 50;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    // --- MOUSE HACK ---
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
            // Slower, dramatic cinematic sweep around the reactor
            const eye: [number, number, number] = [
                Math.sin(time * 0.015) * 160,
                60 + Math.sin(time * 0.02) * 40,
                Math.cos(time * 0.015) * 160
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