// main.ts
import './style.css';
import { NullGraph, Camera } from 'null-graph';
import { generateDummyData } from './data';
import gsap from 'gsap';
import { initUI, UIState } from "./ui";
import {setupSoA} from "./demos/SoAExample";
import {setupAoS} from "./demos/AoSExample";
import {setupSceneGraph} from "./demos/SceneGraphExample";
import {setupAoSoA} from "./demos/AoSoAExample";

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

    // Dynamic Demo State
    let activeUpdateLoop: ((simTime: number) => void) | null = null;
    let activeDestroyFunc: (() => void) | null = null;

    // Switch Demos based on UI clicks
    const loadDemo = async (demoId: string) => {
        if (activeDestroyFunc) activeDestroyFunc(); // Clean up old demo
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


        camera.updateView(
            [Math.sin(simTime) * camControl.radius, 30, Math.cos(simTime) * camControl.radius],
            [0, 0, 0]
        );
        engine.updateCamera(camera);
        engine.render();

        requestAnimationFrame(frame);
    }

    // Load default demo and start loop
    await loadDemo('demo-aos');
    frame();
}

main();