import { NullGraph, Camera } from 'null-graph';
// Import your GLBParser here
import { GLBParser } from 'null-graph/loaders';

export async function setupGLBLoaderExample(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    const mainPass = engine.createPass({
        name: '3d Monkey Main Pass',
        isMainScreenPass: true
    });

    // 1. Load the GLB file asynchronously
    const glbData = await GLBParser.load('./3dAssets/monkey.glb');


    if(!glbData.meshes){
        console.log("No mesh data found")
        return ;
    }
    // We'll use the first primitive of the first mesh
    const monkeyMesh = glbData.meshes[0];
    const vertexBuffer = engine.bufferManager.createVertexBuffer(monkeyMesh.vertices);
    const indexBuffer = engine.bufferManager.createIndexBuffer(monkeyMesh.indices);

    // 4. The 3D Shader (Updated for Normals & Simple Lighting)
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
            @location(1) normal: vec3<f32>,      // NEW: Normal from GLB
            @location(2) uv: vec2<f32>,          // NEW: UV from GLB
            @builtin(instance_index) iIdx: u32
        ) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            let worldPos = (localPos * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            
            // Simple directional lighting so the monkeys look 3D
            let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
            let ambient = 0.3;
            let diffuse = max(dot(normal, lightDir), 0.0);
            let lighting = ambient + (diffuse * 0.7);

            out.color = color * lighting; 
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    // 5. Create the Batch using the new custom layout
    const monkeyBatch = engine.createBatch(mainPass, {
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: monkeyMesh.getWebGPULayout()
    });

    // 6. Assign the monkey buffers to the batch
    engine.setBatchGeometry(monkeyBatch, vertexBuffer, indexBuffer, monkeyMesh.indexCount);

    // 7. Setup ECS Data
    const data = new Float32Array(MAX_INSTANCES * 14);
    const originalYPositions = new Float32Array(MAX_INSTANCES);

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 14;
        data[base + 1] = (Math.random() - 0.5) * 100;
        data[base + 2] = (Math.random() - 0.5) * 20;
        data[base + 3] = (Math.random() - 0.5) * 100;
        originalYPositions[i] = data[base + 2];

        // You might need to adjust the scale if your Blender export was huge
        data[base + 8] = 1.0; data[base + 9] = 1.0; data[base + 10] = 1.0;

        data[base + 11] = Math.random(); data[base + 12] = Math.random(); data[base + 13] = Math.random();
    }

    engine.updateBatchData(monkeyBatch, data, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * 14;
                const xPos = data[base + 1];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                data[base + 2] = originalYPositions[i] + waveOffset;
            }
            engine.updateBatchData(monkeyBatch, data, MAX_INSTANCES);
        },
        destroy: () => {
            engine.clearPasses();
            // Important: Clean up raw WebGPU buffers if NullGraph doesn't track them automatically
            vertexBuffer.destroy();
            indexBuffer.destroy();
            console.log("Cleaning up 3D Demo");
        }
    };
}