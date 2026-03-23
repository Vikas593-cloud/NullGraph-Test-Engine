import {generateDummyData} from "../data";

import { NullGraph, Camera } from 'null-graph';
export async function setupAoS(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }){
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var tri = array<vec2<f32>, 3>(vec2(0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
            let worldPos = (vec3<f32>(tri[vIdx], 0.0) * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            out.color = color;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    // 1. Setup Pipeline
    const trianglesBatch=engine.createBatch({
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: 10000
    });

    // 2. Setup Data
    const data = generateDummyData(10000, 14);
    const originalYPositions = new Float32Array(10000);
    for (let i = 0; i < 10000; i++) {
        originalYPositions[i] = data[i * 14 + 2];
    }
    engine.updateBatchData(trianglesBatch,data, 10000);

    // 3. Return the specific update loop for this demo
    return {
        update: (simTime: number) => {
            for (let i = 0; i < 10000; i++) {
                const base = i * 14;
                const xPos = data[base + 1];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * getUiState().amplitude;
                data[base + 2] = originalYPositions[i] + waveOffset;
            }
            engine.updateBatchData(trianglesBatch,data, 10000);
        },
        destroy: () => {
            engine.clearBatches();
            console.log("Destroying AoS Demo");
        }
    };
}
