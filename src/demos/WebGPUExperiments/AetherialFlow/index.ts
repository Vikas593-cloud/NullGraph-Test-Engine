// demos/WebGPUExperiments/AetherialFlow/index.ts
import { NullGraph, Camera } from 'null-graph';
import { pyramidIndices, pyramidVertices } from "../../../data";
import { aetherComputeShader, aetherRenderShader } from "./shaders";
import { bokehBloomPostProcessShader } from "./postProcessShaders";
import { UIState } from "../../../ui";

export async function setupAetherialFlow(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 150000; // Push it higher! The GPU can handle it.
    const STRIDE = 14;

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
        name: 'Aetherial Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.001, g: 0.005, b: 0.015, a: 1.0 }, // Deep midnight blue
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const physicsBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: aetherComputeShader,
        shaderCode: aetherRenderShader,
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

    // --- 3. POST PROCESS PASS (BOKEH & BLOOM) ---
    const postPass = engine.createPass({
        name: 'Aetherial Post Process',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: bokehBloomPostProcessShader,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- 4. INITIALIZATION ---
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Spawn particles in a chaotic noise cloud rather than a perfect sphere
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;

        initialData[base + 1] = x;
        initialData[base + 2] = y;
        initialData[base + 3] = z;

        // Initial Velocity
        initialData[base + 4] = 0;
        initialData[base + 5] = 0;
        initialData[base + 6] = 0;
    }

    engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    const postProcessTimeData = new Float32Array([0]);

    // --- MOUSE TRACKING HACK ---
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
        // Normalize mouse coordinates to -1.0 to 1.0 (WebGPU clip space)
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0; // Invert Y for 3D math
    };
    window.addEventListener('mousemove', onMouseMove);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;

            // HIJACKING UNUSED BYTES: The compute shader doesn't actually use
            // the camera's eye position, so we overwrite eye.x and eye.y with mouse data!
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;

            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Let's slow down the camera sweep slightly so the mouse interaction feels better
            const eye: [number, number, number] = [
                Math.sin(time * 0.02) * 180,
                30 + Math.cos(time * 0.03) * 20,
                Math.cos(time * 0.02) * 180
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            window.removeEventListener('mousemove', onMouseMove); // Clean up!
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}