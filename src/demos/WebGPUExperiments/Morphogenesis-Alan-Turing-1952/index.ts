import { NullGraph, Camera } from 'null-graph';
import { morphogenesisComputeShader, morphogenesisRenderShader } from "./shaders";
import { UIState } from "../../../types";
import { CompleteLayout, Primitives } from "null-graph/geometry";
import {OrbitalControls} from "../../../utils/OrbitalControls";
import {hexToRGB} from "../../../utils/helper";

export async function setupMorphogenesisAlanTuring1952(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const GRID_SIZE = 1024;
    const MAX_CELLS = GRID_SIZE * GRID_SIZE;
    const STRIDE = 4;

    const torusGeom = Primitives.createTorus(CompleteLayout, 50.0, 12.0, GRID_SIZE, GRID_SIZE);
    torusGeom.upload(engine);

    const scenePass = engine.createPass({
        name: 'MorphoGenesis Main Pass',
        isMainScreenPass: true
    });

    const reactionBatch = engine.createBatch(scenePass, {
        isIndirect: true,
        computeShaderCode: morphogenesisComputeShader,
        shaderCode: morphogenesisRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_CELLS,
        vertexLayouts: torusGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true
    });

    const initialDrawArgs = new Uint32Array([torusGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(reactionBatch.indirectBuffer!, 0, initialDrawArgs);
    engine.setBatchGeometry(reactionBatch, torusGeom.vertexBuffer!, torusGeom.indexBuffer!, torusGeom.indices.length, 'uint32');

    // 12 floats total: 2 (feed, kill) + 2 (padding) + 4 (baseCol) + 4 (peakCol) = 48 bytes
    const paramsBuffer = engine.device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'Morphogenesis Params Buffer'
    });

    const paramsData = new Float32Array(12);

    engine.attachCustomBindGroup(reactionBatch, [
        { binding: 0, resource: { buffer: paramsBuffer } }
    ], 1,'both');
    const initializeGrid = () => {
        const initialData = new Float32Array(MAX_CELLS * STRIDE);
        for (let i = 0; i < MAX_CELLS; i++) {
            const base = i * STRIDE;

            initialData[base] = 1.0;     // Chemical A
            initialData[base + 1] = 0.0; // Chemical B

            const cx = GRID_SIZE / 2;
            const cy = GRID_SIZE / 2;
            const dx = (i % GRID_SIZE) - cx;
            const dy = Math.floor(i / GRID_SIZE) - cy;

            // 1. Central cluster
            if (dx * dx + dy * dy < 400) {
                initialData[base + 1] = 1.0;
            }

            // 2. Random spores
            if (Math.random() > 0.995) {
                initialData[base + 1] = 1.0;
            }
        }
        engine.updateBatchData(reactionBatch, initialData, MAX_CELLS);
    };

    // Run it once on boot
    initializeGrid();



    const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
    if(!canvas) {return;}
    const controls = new OrbitalControls({
        canvas,
        target: [0, 20.0, 0],
        distance:100,
        maxDistance:400,
        minDistance:1
    });

    return {
        // Inside setupMorphogenesisAlanTuring1952 return block:
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;

            const ui = getState();

            // paramsData is the Float32Array attached to Uniform Buffer (Group 1)
            paramsData[0] = ui.feedRate;
            paramsData[1] = ui.killRate;
            paramsData[2] = ui.timeScale;

            paramsData[4] = ui.baseColor[0];
            paramsData[5] = ui.baseColor[1];
            paramsData[6] = ui.baseColor[2];

            paramsData[8] = ui.peakColor[0];
            paramsData[9] = ui.peakColor[1];
            paramsData[10] = ui.peakColor[2];

            engine.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            if (ui.wantsRestart) {
                initializeGrid();
                ui.wantsRestart = false;
            }
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye = controls.getCameraPosition();
            cam.updateView(eye, controls.target);
        },
        destroy: () => {
            paramsBuffer.destroy(); // Clean up!
            engine.clearPasses();
        }
    };
}