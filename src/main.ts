import './main.css';
import { NullGraph, Camera } from 'null-graph';
import gsap from 'gsap';
import { CustomDemoContext, DemoId, DemoRegistryEntry, UIState } from "./types";
import { initUI } from "./ui";
import { demoRegistry } from "./data/demoRegistryData";
import { GPUProfiler } from "null-graph/profiler";
import { PerformanceWidget } from "null-graph/debug-ui";

// Global UI State
let uiState: UIState = {
    // Existing defaults
    timeScale: 0.3,
    amplitude: 2.0,
    auraR: 30.0,
    auraG: 0.0,
    auraB: 5.0,

    // Morphogenesis
    feedRate: 0.055,
    killRate: 0.062,
    baseColor: [5/255, 13/255, 38/255],
    peakColor: [51/255, 230/255, 204/255],

    // Gyroid defaults
    coreColor: [0.0, 0.8, 1.0],     // Cyan Base
    exciteColor: [1.0, 0.2, 0.5],   // Hot Pink for high velocity
    fractureColor: [3.0, 2.0, 0.5], // Blinding gold near mouse (HDR values)

    // Aetherial Flow
    curveColor :[0.0, 1.0, 0.7],
    fastColor:[1.0, 0.0, 0.8],
    pulseColor:[0.2, 0.2, 0.5],

    //--Singularity
    coolColor :[0.05, 0.0, 0.2],
    hotColor:[0.0, 0.8, 1.0],
    coreSingularityColor:[1.0, 0.9, 0.8],

    wantsRestart: false
};
// ---------------------------------------------------------
// MAIN ENGINE & RENDER LOOP
// ---------------------------------------------------------
async function main() {
    const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
    const loadingScreen = document.getElementById('loading-screen');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new NullGraph();

    // 1. Initialize Engine
    await engine.init(canvas, { desiredFeatures: ['timestamp-query'] });
    const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);
    let activeCameraUpdate: ((cam: Camera, time: number, ctrl: any) => void) | null = null;

    // 2. Safely initialize Profiler ONLY if hardware supports it
    let profiler: GPUProfiler | null = null;
    if (engine.device.features.has('timestamp-query')) {
        profiler = new GPUProfiler(engine.device);
    } else {
        console.warn("Timestamp queries not supported on this device. GPU FPS disabled.");
    }

    const perfWidget = new PerformanceWidget();

    // Dynamic Demo State
    let activeUpdateLoop: ((simTime: number) => void) | null = null;
    let activeDestroyFunc: (() => void) | null = null;

    const showLoader = () => {
        if (loadingScreen) {
            loadingScreen.style.pointerEvents = 'all';
            gsap.killTweensOf(loadingScreen);
            gsap.to(loadingScreen, { opacity: 1, duration: 0.2, ease: "power2.out" });
        }
    };
    const hideLoader = () => {
        if (loadingScreen) {
            gsap.killTweensOf(loadingScreen);
            gsap.to(loadingScreen, {
                opacity: 0,
                duration: 0.6,
                ease: "power2.inOut",
                onComplete: () => {
                    loadingScreen.style.pointerEvents = 'none';
                }
            });
        }
    };

    const loadDemo = async (demoId: DemoId) => {
        showLoader();

        if (activeDestroyFunc) activeDestroyFunc();
        activeCameraUpdate = null;

        const getState = () => uiState;
        const registry = demoRegistry as Record<DemoId, DemoRegistryEntry>;
        const entry = registry[demoId];

        if (!entry) {
            console.warn(`Unknown demoId: ${demoId}`);
            hideLoader();
            return;
        }

        const ctx: CustomDemoContext = {
            activeUpdateLoop: null,
            activeDestroyFunc: null,
        };

        try {
            if (entry.custom) {
                await entry.custom(engine, camera, getState, ctx);
                activeUpdateLoop = ctx.activeUpdateLoop;
                activeDestroyFunc = ctx.activeDestroyFunc;
            } else if (entry.setup) {
                const demo = await entry.setup(engine, camera, getState);
                activeUpdateLoop = demo.update;
                activeDestroyFunc = demo.destroy;
                if (entry.camera) {
                    activeCameraUpdate = demo.cameraUpdate || null;
                }
            }
        } catch (error) {
            console.error("Failed to load demo:", error);
        } finally {
            hideLoader();
        }
    };

    // Initialize UI
    const ui = initUI(
        (newState) => { uiState = newState; },
        (demoId:DemoId) => { loadDemo(demoId); }
    );

    let simTime = 0;
    let lastFrameTime = performance.now();
    let frames = 0;
    let camControl = { radius: 100 };

    document.getElementById('action-btn')?.addEventListener('click', () => {
        gsap.to(camControl, { radius: 40, duration: 0.6, yoyo: true, repeat: 1, ease: "power2.inOut" });
    });


    // Inside main.ts
    function frame() {


        // 1. Start CPU timer
        const startCpu = performance.now();

        const now = performance.now();
        const deltaTime = (now - lastFrameTime) * 0.001;
        lastFrameTime = now;
        simTime += deltaTime * uiState.timeScale;

        if (profiler) profiler.begin();

        if (activeUpdateLoop) activeUpdateLoop(simTime);

        if (activeCameraUpdate) {
            activeCameraUpdate(camera, simTime, camControl);
        } else {
            camera.updateView(
                [Math.sin(simTime) * camControl.radius, 30, Math.cos(simTime) * camControl.radius],
                [0, 0, 0]
            );
        }

        engine.updateCamera(camera);
        engine.render();

        const cpuMs = performance.now() - startCpu;

        // 3. Sync Net FPS
        perfWidget.tick();

        // 4. Async GPU tracking
        if (profiler) {
            profiler.end((gpuMs) => {
                perfWidget.updateMetrics(cpuMs, gpuMs);
            });
        } else {
            perfWidget.updateMetrics(cpuMs, 0);
        }

        requestAnimationFrame(frame);
    }

    // Load default demo and start loop
    const defaultDemo = 'demo-3d-cube-ambient-light';

    ui.syncUI(defaultDemo);
    await loadDemo(defaultDemo);
    frame();
}

main();