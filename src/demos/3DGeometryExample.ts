// demos/Geometry3DExample.ts
import { NullGraph, Camera } from 'null-graph';

export async function setup3DCube(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    // 1. Define the 3D Cube Geometry (8 corners, 36 indices)
    const cubeVertices = new Float32Array([
        -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5, // Front
        -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5  // Back
    ]);

    const cubeIndices = new Uint16Array([
        0, 1, 2, 2, 3, 0, // Front
        1, 5, 6, 6, 2, 1, // Right
        7, 6, 5, 5, 4, 7, // Back
        4, 0, 3, 3, 7, 4, // Left
        3, 2, 6, 6, 7, 3, // Top
        4, 5, 1, 1, 0, 4  // Bottom
    ]);

    // 2. Upload Geometry to GPU via the new BufferManager
    const vbo = engine.bufferManager.createVertexBuffer(cubeVertices);
    const ibo = engine.bufferManager.createIndexBuffer(cubeIndices);

    // 3. The 3D Shader
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(
            @location(0) localPos: vec3<f32>,   
            @builtin(instance_index) iIdx: u32
        ) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            let worldPos = (localPos * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            
            out.color = color * (localPos + 0.6); 
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    // 4. FIX: Save the created batch to a variable
    const cubeBatch = engine.createBatch({
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: [{
            arrayStride: 3 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
    });

    // 5. FIX: Assign the geometry to the specific batch
    engine.setBatchGeometry(cubeBatch, vbo, ibo, cubeIndices.length);

    // 6. Setup ECS Data
    const data = new Float32Array(MAX_INSTANCES * 14);
    const originalYPositions = new Float32Array(MAX_INSTANCES);

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 14;
        data[base + 1] = (Math.random() - 0.5) * 100;
        data[base + 2] = (Math.random() - 0.5) * 20;
        data[base + 3] = (Math.random() - 0.5) * 100;
        originalYPositions[i] = data[base + 2];

        data[base + 8] = 1.0; data[base + 9] = 1.0; data[base + 10] = 1.0;
        data[base + 11] = Math.random(); data[base + 12] = Math.random(); data[base + 13] = Math.random();
    }

    // FIX: Pass the batch reference
    engine.updateBatchData(cubeBatch, data, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * 14;
                const xPos = data[base + 1];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                data[base + 2] = originalYPositions[i] + waveOffset;
            }
            // FIX: Pass the batch reference
            engine.updateBatchData(cubeBatch, data, MAX_INSTANCES);
        },
        destroy: () => {
            engine.clearBatches();
            console.log("Cleaning up 3D Demo");
        }
    };
}