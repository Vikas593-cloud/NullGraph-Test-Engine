import { NullGraph, Camera } from 'null-graph';
import { setupPostProcessPipeline } from './RenderPipeline';
import { loadAnimatedCharacter } from './CharacterSetup';
import {UIState} from "../../../types";
import {OrbitalControls} from "../../../utils/OrbitalControls";
import {addSciFiEnvironment} from "./Enviroment/SciFiEnviroment";

export async function setupAnimationwithPostProcessing(engine: NullGraph, camera: Camera,getUiState: () => UIState) {

    // 1. Setup Pipeline
    const pipeline = setupPostProcessPipeline(engine);

    // 2. Setup Character
    const character = await loadAnimatedCharacter(
        engine,
        pipeline.offscreenPass,
        './AnimatedMixamo/HipHopDancingGirl.glb'
    );

    const environment = await addSciFiEnvironment(
        engine,
        pipeline.offscreenPass,
        camera
    );
    if(!environment){
        return ;
    }

    let isDestroyed = false;
    let lastTime = 0;
    const timeData = new Float32Array([0]);

    const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
    if(!canvas) {return;}
    const controls = new OrbitalControls({
        canvas,
        target: [0, 1.0, 0],
        distance: 7
    });
    let curR = 30.0, curG = 0.0, curB = 5.0;

    return {
        update: (simTime: number) => {
            if (isDestroyed) return;

            const now = performance.now();
            const deltaTime = lastTime === 0 ? 0.016 : (now - lastTime) / 1000;
            lastTime = now;
            const state = getUiState();

            // 2. If any slider moved, update the GPU
            if (state.auraR !== curR || state.auraG !== curG || state.auraB !== curB) {
                curR = state.auraR;
                curG = state.auraG;
                curB = state.auraB;

                // Directly apply the raw slider numbers!
               character.updateHairColor(curR, curG, curB);
            }

            character.updateBones(deltaTime);
            environment.update(simTime)

            timeData[0] = simTime;
            engine.updateBatchData(pipeline.postBatch, timeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Convert spherical coordinates (theta, phi) to Cartesian (x, y, z)
            const eye = controls.getCameraPosition();

            // Look at the center of the character
            cam.updateView(eye,controls.target);
        },
        destroy: () => {
            isDestroyed = true;
            controls.destroy();
           character.destroy();
            pipeline.destroy();
            environment.destroy();
            engine.clearPasses();
        }
    };
}
///
/// Notes:When importing fbx model in blender for animations always ignore leaf bondes
//https://www.cgtrader.com/designers/runsystem?utm_source=credit&utm_source=credit_item_page