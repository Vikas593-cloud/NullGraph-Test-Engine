// demos/AoSoAExample.ts
import { NullGraph, Camera } from 'null-graph';

export async function setupAoSoA(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;
    const CHUNK_SIZE = 16;
    const STRIDE = 14;
    const CHUNK_FLOATS = CHUNK_SIZE * STRIDE; // 224 floats per chunk

    // The Shader: Uses bitwise math to decode chunks instantly
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
            let CHUNK_SIZE = 16u;
            let CHUNK_FLOATS = 224u; // 16 * 14
            
            // FAST MATH: iIdx / 16 = iIdx >> 4; iIdx % 16 = iIdx & 15;
            let chunkIdx = iIdx >> 4u; 
            let localIdx = iIdx & 15u; 
            let chunkBase = chunkIdx * CHUNK_FLOATS;

            // Memory fetches (Chunk Base + (Property Index * Chunk Size) + Local Offset)
            let px = ecs[chunkBase + (1u * CHUNK_SIZE) + localIdx];
            let py = ecs[chunkBase + (2u * CHUNK_SIZE) + localIdx];
            let pz = ecs[chunkBase + (3u * CHUNK_SIZE) + localIdx];
            let pos = vec3<f32>(px, py, pz);

            let sx = ecs[chunkBase + (8u * CHUNK_SIZE) + localIdx];
            let sy = ecs[chunkBase + (9u * CHUNK_SIZE) + localIdx];
            let sz = ecs[chunkBase + (10u * CHUNK_SIZE) + localIdx];
            let scale = vec3<f32>(sx, sy, sz);

            let cr = ecs[chunkBase + (11u * CHUNK_SIZE) + localIdx];
            let cg = ecs[chunkBase + (12u * CHUNK_SIZE) + localIdx];
            let cb = ecs[chunkBase + (13u * CHUNK_SIZE) + localIdx];
            let color = vec3<f32>(cr, cg, cb);

            var tri = array<vec2<f32>, 3>(vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
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

    engine.createPipeline({
        shaderCode: shaderSource,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES
    });

    // 2. Generate Chunked Data
    const totalFloats = MAX_INSTANCES * STRIDE;
    const data = new Float32Array(totalFloats);
    const originalYPositions = new Float32Array(MAX_INSTANCES);

    const numChunks = Math.ceil(MAX_INSTANCES / CHUNK_SIZE);

    for (let c = 0; c < numChunks; c++) {
        const chunkBase = c * CHUNK_FLOATS;

        // Loop through the 16 items in this specific chunk
        for (let i = 0; i < CHUNK_SIZE; i++) {
            const globalIdx = (c * CHUNK_SIZE) + i;
            if (globalIdx >= MAX_INSTANCES) break;

            const startY = (Math.random() - 0.5) * 20;

            // Property 1, 2, 3: Position
            data[chunkBase + (1 * CHUNK_SIZE) + i] = (Math.random() - 0.5) * 100; // X
            data[chunkBase + (2 * CHUNK_SIZE) + i] = startY;                      // Y
            data[chunkBase + (3 * CHUNK_SIZE) + i] = (Math.random() - 0.5) * 100; // Z
            originalYPositions[globalIdx] = startY;

            // Property 8, 9, 10: Scale
            data[chunkBase + (8 * CHUNK_SIZE) + i] = 1.0;
            data[chunkBase + (9 * CHUNK_SIZE) + i] = 1.0;
            data[chunkBase + (10 * CHUNK_SIZE) + i] = 1.0;

            // Property 11, 12, 13: Color
            data[chunkBase + (11 * CHUNK_SIZE) + i] = Math.random();
            data[chunkBase + (12 * CHUNK_SIZE) + i] = Math.random();
            data[chunkBase + (13 * CHUNK_SIZE) + i] = Math.random();
        }
    }

    engine.updateData(data, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // THE AoSoA UPDATE LOOP
            // We iterate chunk by chunk, maximizing CPU cache efficiency.
            for (let c = 0; c < numChunks; c++) {
                const chunkBase = c * CHUNK_FLOATS;
                const pxOffset = chunkBase + (1 * CHUNK_SIZE); // Jump to X array in this chunk
                const pyOffset = chunkBase + (2 * CHUNK_SIZE); // Jump to Y array in this chunk

                // SIMD-friendly inner loop
                for (let i = 0; i < CHUNK_SIZE; i++) {
                    const globalIdx = (c * CHUNK_SIZE) + i;
                    if (globalIdx >= MAX_INSTANCES) break;

                    const xPos = data[pxOffset + i];
                    const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                    data[pyOffset + i] = originalYPositions[globalIdx] + waveOffset;
                }
            }
            engine.updateData(data, MAX_INSTANCES);
        },
        destroy: () => {
            console.log("Cleaning up AoSoA Demo");
        }
    };
}