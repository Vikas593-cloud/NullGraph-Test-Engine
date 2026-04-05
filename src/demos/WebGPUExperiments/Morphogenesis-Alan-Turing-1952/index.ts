import { NullGraph, Camera } from 'null-graph';
import { morphogenesisComputeShader, morphogenesisRenderShader } from "./shaders";
import { UIState } from "../../../types";
import { CompleteLayout, Primitives } from "null-graph/geometry";

export async function setupMorphogenesisAlanTuring1952(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const GRID_SIZE = 256;
    const MAX_CELLS = GRID_SIZE * GRID_SIZE;
    const STRIDE = 4;

    const torusGeom = Primitives.createTorus(CompleteLayout, 25.0, 7.0, GRID_SIZE, GRID_SIZE);
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
        maxInstances: MAX_CELLS, // BACK TO NORMAL SIZE!
        vertexLayouts: torusGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true
    });

    const initialDrawArgs = new Uint32Array([torusGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(reactionBatch.indirectBuffer!, 0, initialDrawArgs);
    engine.setBatchGeometry(reactionBatch, torusGeom.vertexBuffer!, torusGeom.indexBuffer!, torusGeom.indices.length, 'uint32');

    // INITIALIZE GRID
    const initialData = new Float32Array(MAX_CELLS * STRIDE);
    for (let i = 0; i < MAX_CELLS; i++) {
        const base = i * STRIDE;

        initialData[base] = 1.0;     // Chemical A fills the world
        initialData[base + 1] = 0.0; // Chemical B starts empty

        const cx = GRID_SIZE / 2;
        const cy = GRID_SIZE / 2;
        const dx = (i % GRID_SIZE) - cx;
        const dy = Math.floor(i / GRID_SIZE) - cy;

        // 1. Keep the main central cluster
        if (dx * dx + dy * dy < 400) {
            initialData[base + 1] = 1.0;
        }

        // 2. THE FIX: Sprinkle random "spores" of Chemical B everywhere!
        // This gives the reaction thousands of starting points across the donut.
        if (Math.random() > 0.995) {
            initialData[base + 1] = 1.0;
        }
    }

    engine.updateBatchData(reactionBatch, initialData, MAX_CELLS);

    engine.updateBatchData(reactionBatch, initialData, MAX_CELLS);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye: [number, number, number] = [
                Math.sin(time * 0.2) * 50,
                30,
                Math.cos(time * 0.2) * 50
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            engine.clearPasses();
        }
    };
}