import { NullGraph, Camera } from 'null-graph';
import { implicitScreensaverShader } from "./shaders";
import {UIState} from "../../../types"; // We will create this below

export async function setupImplicitScreensaver(engine: NullGraph, camera: Camera, getState: () => UIState) {
    // --- 1. MAIN SCREEN PASS ---
    // Ray marching renders directly to the screen, so we don't need G-Buffers!
    const implicitPass = engine.createPass({
        name: 'Implicit Screensaver Pass',
        isMainScreenPass: true
    });

    const implicitBatch = engine.createBatch(implicitPass, {
        shaderCode: implicitScreensaverShader,
        strideFloats: 1,      // We only need an empty array to trigger the batch
        maxInstances: 1       // Only 1 instance (the full screen quad)
    });

    // --- 2. INITIALIZATION ---
    const timeData = new Float32Array([0]);
    engine.updateBatchData(implicitBatch, timeData, 1);

    return {
        update: (simTime: number) => {
            // Send time to the GPU via the ECS storage buffer
            timeData[0] = simTime;
            engine.updateBatchData(implicitBatch, timeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Orbiting camera for the screen saver
            const eye: [number, number, number] = [
                Math.sin(time * 0.3) * 10,
                Math.sin(time * 0.1) * 5 + 5,
                Math.cos(time * 0.3) * 10
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            engine.clearPasses();
        }
    };
}