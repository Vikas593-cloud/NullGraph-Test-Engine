// demos/QuantumCore/index.ts
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";
import { quantumCoreSceneShader, godRaysPostProcessShader } from "./shaders";
import { generateCoreData, MAX_INSTANCES, STRIDE } from "./geometry";
import {UIState} from "../../../ui";

export async function setupQuantumCoreDemo(engine: NullGraph, camera: Camera, getState: () => UIState) {

    // --- 1. HDR OFFSCREEN TEXTURE ---
    // We use rgba16float to store values > 1.0 for true Bloom / God Rays
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

    // --- 2. SCENE PASS (Renders the geometry) ---
    const scenePass = engine.createPass({
        name: 'Quantum Core Scene HDR',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.01, a: 1.0 }, // Deep space void
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const cubeGeom = Primitives.createCube(StandardLayout, 1.0, 1.0, 1.0);
    cubeGeom.upload(engine);

    const sceneBatch = engine.createBatch(scenePass, {
        shaderCode: quantumCoreSceneShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    });

    engine.setBatchGeometry(sceneBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    // --- 3. POST PROCESS PASS (God Rays & Tonemapping) ---
    const postPass = engine.createPass({
        name: 'God Rays & Tonemap',
        isMainScreenPass: true
    });

    const postBatch = engine.createBatch(postPass, {
        shaderCode: godRaysPostProcessShader,
        strideFloats: 1, // Only passing simTime
        maxInstances: 1,
        vertexLayouts: []
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    // --- 4. INITIALIZATION & INTERACTION ---
    const { data, particleStates } = generateCoreData();
    const timeData = new Float32Array([0]);

    // Track mouse for parallax effect
    let mouseX = 0;
    let mouseY = 0;
    const targetMouse = { x: 0, y: 0 };

    const onMouseMove = (e: MouseEvent) => {
        // Normalize mouse to -1 to 1
        targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    return {
        update: (simTime: number) => {
            // Smoothly interpolate mouse for buttery movement
            mouseX += (targetMouse.x - mouseX) * 0.05;
            mouseY += (targetMouse.y - mouseY) * 0.05;

            // CPU Orbital Physics Update
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;
                const state = particleStates[i];

                state.theta += (state.speed * 0.01);

                const r = Math.cos(state.knotQ * state.theta) + state.radius;
                const x = r * Math.cos(state.knotP * state.theta);
                const y = Math.sin(state.knotQ * state.theta) * (state.radius * 0.5);
                const z = r * Math.sin(state.knotP * state.theta);

                // Add turbulence, but let the mouse X position act as a "gravity disruptor"
                const turbulence = Math.sin(simTime * 2.0 + i) * (0.5 + Math.abs(mouseX) * 2.0);

                data[base + 1] = x + turbulence;
                data[base + 2] = y + turbulence;
                data[base + 3] = z + turbulence;
            }

            engine.updateBatchData(sceneBatch, data, MAX_INSTANCES);

            timeData[0] = simTime;
            engine.updateBatchData(postBatch, timeData, 1);
        },

        cameraUpdate: (cam: Camera, time: number, ctrl: any) => {
            // 1. Cinematic Drift: The base camera slowly breathes in and out
            const baseRadius = 35 + Math.sin(time * 0.2) * 10;

            // 2. Position: Calculate the eye position, influenced by Mouse Y
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * baseRadius,
                Math.cos(time * 0.15) * 10 + (mouseY * 20), // Mouse moves cam up/down
                Math.cos(time * 0.1) * baseRadius
            ];

            // 3. Parallax Target: The camera looks slightly off-center based on Mouse X/Y
            // This gives a heavy 3D parallax feel when tracking the cursor
            const target: [number, number, number] = [
                mouseX * 20, // Look left/right
                mouseY * 10, // Look slightly up/down
                0
            ];

            cam.updateView(eye, target);
        },

        destroy: () => {
            // ALWAYS clean up event listeners!
            window.removeEventListener('mousemove', onMouseMove);
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}