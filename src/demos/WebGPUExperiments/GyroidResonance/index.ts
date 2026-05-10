import { NullGraph, Camera } from 'null-graph';
import { UIState } from "../../../types";
import { Primitives, StandardLayout } from "null-graph/geometry";

export async function setupGyroidResonance(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 150000;
    const STRIDE = 14;

    const [computeRes,renderRes,postRes] = await Promise.all([
        fetch('./shaders/demos/WebGPUExperiments/GyroidResonance/gyroid.compute.wgsl'),
        fetch('./shaders/demos/WebGPUExperiments/GyroidResonance/gyroid.render.wgsl'),
        fetch('./shaders/demos/WebGPUExperiments/GyroidResonance/halationScattering.postprocess.wgsl')
    ]);


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

    const gyroidComputeShader = await computeRes.text();
    const gyroidRenderShader = await renderRes.text()
    const halationScatteringPostProcess = await postRes.text();

    const scenePass = engine.createPass({
        name: 'Gyroid Main Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.002, g: 0.001, b: 0.005, a: 1.0 },
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

    const pyramidGeom = Primitives.createPyramid(StandardLayout, 1.0, 1.0, 1.0);
    pyramidGeom.upload(engine);

    const initialDrawArgs = new Uint32Array([pyramidGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(physicsBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(
        physicsBatch,
        pyramidGeom.vertexBuffer!,
        pyramidGeom.indexBuffer!,
        pyramidGeom.indices.length
    );

    // --- NEW: COLOR PARAMS BUFFER ---
    // 3 colors (vec3) + 1 float padding each = 12 floats = 48 bytes
    const paramsBuffer = engine.device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'Gyroid Color Params'
    });
    const paramsData = new Float32Array(12);

    // Attach to @group(1) @binding(0) so we don't conflict with group 0
    engine.attachCustomBindGroup(physicsBatch, [
        { binding: 0, resource: { buffer: paramsBuffer } }
    ], 1, 'compute'); // Only the compute shader needs these colors

    // --- NEW: RESTART FUNCTION ---
    const initializeGyroid = () => {
        const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
        for (let i = 0; i < MAX_INSTANCES; i++) {
            const base = i * STRIDE;
            const angle = Math.random() * Math.PI * 2;
            const radius = 80 + (Math.random() - 0.5) * 40;
            const height = (Math.random() - 0.5) * 40;

            initialData[base + 1] = Math.cos(angle) * radius;
            initialData[base + 2] = height;
            initialData[base + 3] = Math.sin(angle) * radius;

            initialData[base + 4] = -Math.sin(angle) * 20;
            initialData[base + 5] = (Math.random() - 0.5) * 10;
            initialData[base + 6] = Math.cos(angle) * 20;
        }
        engine.updateBatchData(physicsBatch, initialData, MAX_INSTANCES);
    };

    // Run once on boot
    initializeGyroid();

    const postPass = engine.createPass({
        name: 'Halation Scattering Pass',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: halationScatteringPostProcess,
        strideFloats: 1, maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    const postProcessTimeData = new Float32Array([0]);
    let isDestroyed = false;

    let mouseX = 0; let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
    };
    window.addEventListener('mousemove', onMouseMove);

    return {
        update: (simTime: number) => {
            const ui = getState();
            if (isDestroyed) return;

            camera.bufferData[19] = simTime;
            camera.bufferData[16] = mouseX;
            camera.bufferData[17] = mouseY;

            // --- NEW: UPDATE COLORS ---
            paramsData[0] = ui.coreColor[0];
            paramsData[1] = ui.coreColor[1];
            paramsData[2] = ui.coreColor[2];
            // index 3 is padding

            paramsData[4] = ui.exciteColor[0];
            paramsData[5] = ui.exciteColor[1];
            paramsData[6] = ui.exciteColor[2];
            // index 7 is padding

            paramsData[8] = ui.fractureColor[0];
            paramsData[9] = ui.fractureColor[1];
            paramsData[10] = ui.fractureColor[2];
            // index 11 is padding

            engine.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            // --- NEW: HANDLE RESTART ---
            if (ui.wantsRestart) {
                initializeGyroid();
                ui.wantsRestart = false; // Acknowledge the restart
            }

            postProcessTimeData[0] = simTime;
            engine.updateBatchData(postBatch, postProcessTimeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye: [number, number, number] = [
                Math.sin(time * 0.15) * 160,
                40 + Math.sin(time * 0.1) * 30,
                Math.cos(time * 0.15) * 160
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            isDestroyed = true;
            window.removeEventListener('mousemove', onMouseMove);
            camera.bufferData[19] = 0.0;
            paramsBuffer.destroy(); // Clean up!
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}