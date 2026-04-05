// main.ts
import './main.css';
import { NullGraph, Camera } from 'null-graph';
import { generateDummyData } from './data';
import gsap from 'gsap';
import { initUI } from "./ui";
import {setupSoA} from "./demos/SoAExample";
import {setupAoS} from "./demos/AoSExample";
import {setupSceneGraph} from "./demos/SceneGraphExample";
import {setupAoSoA} from "./demos/AoSoAExample";
import {setup3DCube} from "./demos/3DGeometryExample";
import {setup3DCubeWithAmbientLight} from "./demos/3DGeometryWithLighting";
import {setupSpaceFleet} from "./demos/SpaceFleetExample";
import {setupFireworks} from "./demos/FireWorksExample";
import {setupGPUCulling} from "./demos/GPUCullingExample";
import {setupGPULOD} from "./demos/GPULodExample";
import {setupMegabuffer} from "./demos/MegaBufferExample";
import {setupForwardLightingCyberPunk2077} from "./demos/ForwardLightingCyberPunk2077";
import {setupPostProcessing} from "./demos/PostProcessing";
import {setupCRTEffect} from "./demos/CRTEffect";
import {setupBloomEffect} from "./demos/BloomEffectExample";
import {setupHologramEffect} from "./demos/HologramEffectExample";
import {setupSynthwaveCRT} from "./demos/SynthwaveCRTExample";
import {setupQuantumCoreDemo} from "./demos/WebGPUExperiments/QuantumCore";
import {setupSingularity} from "./demos/WebGPUExperiments/Singularity";
import {setupAetherialFlow} from "./demos/WebGPUExperiments/AetherialFlow";
import {setupGyroidResonance} from "./demos/WebGPUExperiments/GyroidResonance";
import {setupAizawaCanvas} from "./demos/WebGPUExperiments/AizawaCanvas";
import {setupIridescentLeviathan} from "./demos/WebGPUExperiments/IridescentLeviathan";
import {setupLabyrinthChaos} from "./demos/WebGPUExperiments/LabyrinthChaos";
import {setupEtherealGyroid} from "./demos/WebGPUExperiments/EtherealGyroid";
import {setupStellaratorFlux} from "./demos/WebGPUExperiments/StellaratorFlux";
import {setupHopfFibration} from "./demos/WebGPUExperiments/HopfFibration";
import {setupQuantumNebula} from "./demos/WebGPUExperiments/QuantumNebula";
import {setupCymaticResonance} from "./demos/WebGPUExperiments/CymaticResonance";
import {setupDeferredRendering} from "./demos/WebGPUExperiments/DeferredRendering";
import {setupImplicitScreensaver} from "./demos/WebGPUExperiments/ImplicitScreensaver";
import {UIState} from "./types";
import {setupMorphogenesisAlanTuring1952} from "./demos/WebGPUExperiments/Morphogenesis-Alan-Turing-1952";

// Global UI State
let uiState: UIState = { timeScale: 0.3, amplitude: 2.0 };

// ---------------------------------------------------------
// MAIN ENGINE & RENDER LOOP
// ---------------------------------------------------------
async function main() {
    const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new NullGraph();
    await engine.init(canvas);
    const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);
    let activeCameraUpdate: ((cam: Camera, time: number, ctrl: any) => void) | null = null;


    // Dynamic Demo State
    let activeUpdateLoop: ((simTime: number) => void) | null = null;
    let activeDestroyFunc: (() => void) | null = null;

    // Switch Demos based on UI clicks
    const loadDemo = async (demoId: string) => {
        if (activeDestroyFunc) activeDestroyFunc(); // Clean up old demo
        activeCameraUpdate = null;
        const getState = () => uiState;
        if (demoId === 'demo-aos') {
            const demo = await setupAoS(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-soa') {
            const demo = await setupSoA(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-oop') {
            const demo = await setupSceneGraph(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-aosoa') {
            const demo = await setupAoSoA(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-3d-cube') {
            const demo = await setup3DCube(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-3d-cube-ambient-light') {
            const demo = await setup3DCubeWithAmbientLight(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }else if (demoId === 'demo-spacefleet') {
            const demo = await setupSpaceFleet(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-fireworks') {
            const demo = await setupFireworks(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-gpu-culling') {
            const demo = await setupGPUCulling(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-gpu-lod') {
            const demo = await setupGPULOD(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-mega-buffer') {
            const demo = await setupMegabuffer(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
           // activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-forward+-lighting') {
            const demo = await setupForwardLightingCyberPunk2077(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-post-processing') {
            const demo = await setupPostProcessing(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-crt-effect') {
            const demo = await setupCRTEffect(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-bloom-effect') {
            const demo = await setupBloomEffect(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }

        else if (demoId === 'demo-hologram-effect') {
            const demo = await setupHologramEffect(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-synthwave-crt-effect') {
            const demo = await setupSynthwaveCRT(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
        }
        else if (demoId === 'demo-quantumcore') {
            const demo = await setupQuantumCoreDemo(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-singularity') {
            const demo = await setupSingularity(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-aetherial-flow') {
            const demo = await setupAetherialFlow(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-gyroid-resonance') {
            const demo = await setupGyroidResonance(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-aizawa-canvas') {
            const demo = await setupAizawaCanvas(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-iridescent-leviathan') {
            const demo = await setupIridescentLeviathan(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-labyrinth-chaos') {
            const demo = await setupLabyrinthChaos(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-ethereal-gyroid') {
            const demo = await setupEtherealGyroid(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-stellarator-flux') {
            const demo = await setupStellaratorFlux(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-hopffibration') {
            const demo = await setupHopfFibration(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-quantum-nebula') {
            const demo = await setupQuantumNebula(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-cymatic-resonance') {
            const demo = await setupCymaticResonance(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-deferred-rendering') {
            const demo = await setupDeferredRendering(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-implicit-screen-saver') {
            const demo = await setupImplicitScreensaver(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }
        else if (demoId === 'demo-morphogenesis-diffusion') {
            const demo = await setupMorphogenesisAlanTuring1952(engine, camera, getState);
            activeUpdateLoop = demo.update;
            activeDestroyFunc = demo.destroy;
            activeCameraUpdate = demo.cameraUpdate || null;
        }


        // ... add anim-cpu and anim-gpu here later
    };

    // Initialize UI
    const ui = initUI(
        (newState) => { uiState = newState; },
        (demoId) => { loadDemo(demoId); }
    );

    let simTime = 0;
    let lastFrameTime = performance.now();
    let lastFpsTime = performance.now();
    let frames = 0;
    let camControl = { radius: 100 };

    document.getElementById('action-btn')?.addEventListener('click', () => {
        gsap.to(camControl, { radius: 40, duration: 0.6, yoyo: true, repeat: 1, ease: "power2.inOut" });
    });

    // The Single Render Loop
    function frame() {
        const now = performance.now();
        const deltaTime = (now - lastFrameTime) * 0.001;
        lastFrameTime = now;
        simTime += deltaTime * uiState.timeScale;
        frames++;

        if (activeUpdateLoop) {
            activeUpdateLoop(simTime);
        }


        if (now - lastFpsTime >= 1000) {
            ui.updateFPS(frames);
            frames = 0;
            lastFpsTime = now;
        }


        if (activeCameraUpdate) {
            // Use the Demo's custom camera path
            activeCameraUpdate(camera, simTime, camControl);
        } else {
            // DEFAULT FALLBACK: The original orbit for simple demos
            camera.updateView(
                [Math.sin(simTime) * camControl.radius, 30, Math.cos(simTime) * camControl.radius],
                [0, 0, 0]
            );
        }
        engine.updateCamera(camera);
        engine.render();

        requestAnimationFrame(frame);
    }

    // Load default demo and start loop
    await loadDemo('demo-3d-cube-ambient-light');
    frame();
}

main();