// demos/SoAExample.ts
import { NullGraph, Camera } from 'null-graph';
import {pyramidIndices, pyramidVertices} from "../data";

export async function setupSoA(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    // The SoA Shader
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@location(0) localPos:vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let MAX_INSTANCES = ${MAX_INSTANCES}u;
            let i3 = iIdx * 3u;
            
            // Memory jumps for SoA chunking
            let posBase = i3;
            let scaleBase = (MAX_INSTANCES * 3u) + i3;
            let colorBase = (MAX_INSTANCES * 6u) + i3;

            // Read the contiguous data
            let pos = vec3<f32>(ecs[posBase], ecs[posBase + 1u], ecs[posBase + 2u]);
            let scale = vec3<f32>(ecs[scaleBase], ecs[scaleBase + 1u], ecs[scaleBase + 2u]);
            let color = vec3<f32>(ecs[colorBase], ecs[colorBase + 1u], ecs[colorBase + 2u]);

         
            let worldPos = (localPos * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            out.color = color;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
          let ambientLight=0.2;
          
            return vec4<f32>(color, 1.0);
        }
    `;
    const pyramidVbo=engine.bufferManager.createVertexBuffer(pyramidVertices)
    const pyramidIbo=engine.bufferManager.createIndexBuffer(pyramidIndices)
    const mainPass = engine.createPass({
        name: 'SoA Main Pass',
        isMainScreenPass: true
    });

    // Setup Pipeline
    const pyramidBatch=engine.createBatch(mainPass,{
        shaderCode: shaderSource,
        strideFloats: 14, // Keep total memory footprint same as AoS for a fair test
        maxInstances: MAX_INSTANCES,
        vertexLayouts:[
            {
                arrayStride:24,
                attributes:[
                    {
                        shaderLocation:0,
                        offset:0,
                        format:'float32x3',
                    },
                    {
                        shaderLocation:1,
                        offset:12,
                        format:'float32x3'
                    }
                ]
            }
        ]
    });

    // Generate Struct of Arrays Data
    const totalFloats = MAX_INSTANCES * 14;
    const data = new Float32Array(totalFloats);
    const originalYPositions = new Float32Array(MAX_INSTANCES);

    const POS_OFFSET = 0;
    const SCALE_OFFSET = MAX_INSTANCES * 3;
    const COLOR_OFFSET = MAX_INSTANCES * 6;

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const i3 = i * 3;

        // Positions (Chunk 1)
        data[POS_OFFSET + i3 + 0] = (Math.random() - 0.5) * 100; // X
        const startY = (Math.random() - 0.5) * 20;               // Y
        data[POS_OFFSET + i3 + 1] = startY;
        data[POS_OFFSET + i3 + 2] = (Math.random() - 0.5) * 100; // Z
        originalYPositions[i] = startY; // Cache for wave animation

        // Scales (Chunk 2)
        data[SCALE_OFFSET + i3 + 0] = 1.0;
        data[SCALE_OFFSET + i3 + 1] = 1.0;
        data[SCALE_OFFSET + i3 + 2] = 1.0;

        // Colors (Chunk 3)
        data[COLOR_OFFSET + i3 + 0] = Math.random();
        data[COLOR_OFFSET + i3 + 1] = Math.random();
        data[COLOR_OFFSET + i3 + 2] = Math.random();
    }

    engine.setBatchGeometry(pyramidBatch,pyramidVbo,pyramidIbo,pyramidIndices.length)
    engine.updateBatchData(pyramidBatch,data, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // SUPER FAST CPU LOOP: We only iterate over the tightly packed Positions array!
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const i3 = i * 3;
                const xPos = data[POS_OFFSET + i3 + 0];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                data[POS_OFFSET + i3 + 1] = originalYPositions[i] + waveOffset;
            }
            engine.updateBatchData(pyramidBatch,data, MAX_INSTANCES);
        },
        destroy: () => {
            engine.clearPasses()
            console.log("Cleaning up SoA Demo");
        }
    };
}