// demos/WebGPUExperiments/Singularity/index.ts
import { NullGraph, Camera } from 'null-graph';
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

    const [computeRes,renderRes,postRes] = await Promise.all([
        fetch('./shaders/demos/WebGPUExperiments/Singularity/singularity.compute.wgsl'),
        fetch('./shaders/demos/WebGPUExperiments/Singularity/singularity.render.wgsl'),
        fetch('./shaders/demos/WebGPUExperiments/QuantumCore/godrays.postprocess.wgsl')
    ]);

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

    const singularityComputeShader = await computeRes.text();
    const singularityRenderShader = await renderRes.text()
    const godRaysPostProcessShader = await postRes.text();

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

    // 3 colors (vec3) + 1 float padding each = 12 floats = 48 bytes
    const paramsBuffer = engine.device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'Singularity Color Params'
    });
    const paramsData = new Float32Array(12);

    // Attach to @group(1) @binding(0) so we don't conflict with group 0
    engine.attachCustomBindGroup(physicsBatch, [
        { binding: 0, resource: { buffer: paramsBuffer } }
    ], 1, 'compute');

    // --- 5. INITIAL CPU SEEDING ---
    // We only upload this data ONCE. The GPU takes over completely after this.
    const initializeSingularity = () => {
        const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
        const MAX_RADIUS = 800.0; // Matches your new shader bounds

        for (let i = 0; i < MAX_INSTANCES; i++) {
            const base = i * STRIDE;

            // 1. MASSIVE ORGANIC RADIUS
            // Math.pow(..., 0.8) spreads them out a bit more evenly rather than
            // clumping *too* many in the center, giving that "surrounding the camera" feel.
            const r = Math.pow(Math.random(), 0.8) * MAX_RADIUS + 5;

            // 2. POLAR COORDINATES
            const theta = Math.random() * Math.PI * 2;

            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);

            // 3. THICKER CLOUD
            // Increased the Y-thickness significantly so it's not a flat disc.
            // The core is up to 200 units tall, tapering down towards the edges.
            const thickness = Math.max(0, 1.0 - (r / MAX_RADIUS)) * 200 + 20;
            const y = (Math.random() - 0.5) * thickness;

            initialData[base + 1] = x;
            initialData[base + 2] = y;
            initialData[base + 3] = z;

            // 4. SCATTERED VELOCITY
            const speed = 0.02 + (Math.random() * 0.08);

            initialData[base + 4] = (-z * speed) + (Math.random() - 0.5) * 20;
            initialData[base + 5] = (Math.random() - 0.5) * 15;
            initialData[base + 6] = (x * speed) + (Math.random() - 0.5) * 20;
        }
        engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    }
    initializeSingularity()

    // Upload to the Source buffer (which our Compute shader reads AND writes to)
    // This properly seeds the GPU memory AND tells NullGraph we have 100,000 particles!


    const postProcessTimeData = new Float32Array([0]);
    let isDestroyed=false;

    return {
        update: (simTime: number) => {
            if(isDestroyed)return
            const ui=getState();
            camera.bufferData[19] = simTime;

            paramsData[0] = ui.coolColor[0];
            paramsData[1] = ui.coolColor[1];
            paramsData[2] = ui.coolColor[2];
            // index 3 is padding

            paramsData[4] = ui.hotColor[0];
            paramsData[5] = ui.hotColor[1];
            paramsData[6] = ui.hotColor[2];
            // index 7 is padding

            paramsData[8] = ui.coreSingularityColor[0];
            paramsData[9] = ui.coreSingularityColor[1];
            paramsData[10] = ui.coreSingularityColor[2];

            postProcessTimeData[0] = simTime;

            if (ui.wantsRestart) {
                initializeSingularity();
                ui.wantsRestart = false; // Acknowledge the restart
            }

            engine.updateBatchData(postBatch, postProcessTimeData, 1);
            engine.device.queue.writeBuffer(paramsBuffer, 0, paramsData);
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
            paramsBuffer.destroy();
            isDestroyed=true
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}