// demos/Geometry3DExample.ts
import { NullGraph, Camera } from 'null-graph';
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setup3DCubeWithAmbientLight(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;


    const mainPass = engine.createPass({
        name: '3D cube with Lighting Main Pass',
        isMainScreenPass: true
    });
    const cubeGeom=Primitives.createCube(StandardLayout,1.0,1.0,1.0)
    cubeGeom.upload(engine)


    // 2. The Lighting Shader
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
            @location(1) normal: vec3<f32>, // Pass normal to fragment shader!
        };

        @vertex
        fn vs_main(
            @location(0) localPos: vec3<f32>,
            @location(1) localNormal: vec3<f32>, // Grab normal from geometry buffer
            @builtin(instance_index) iIdx: u32
        ) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            let worldPos = (localPos * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            out.color = color;
            out.normal = localNormal; // (If we had rotation in the ECS, we would multiply the normal by it here)
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
            // 1. Define Sunlight Direction (coming from top-right-front)
            let sunDir = normalize(vec3<f32>(1.0, 1.5, 0.5));
            
            // 2. Base ambient light so shadows aren't pitch black
            let ambient = 0.3; 
            
            // 3. Dot Product Math: How directly is the light hitting this face?
            // (max() prevents negative light on the dark side)
            let diffuse = max(dot(normal, sunDir), 0.0); 

            // 4. Combine!
            let finalColor = color * (ambient + diffuse);
            
            return vec4<f32>(finalColor, 1.0);
        }
    `;

    // 3. Tell the Pipeline about the new Normals!
    const cubeBatch=engine.createBatch(mainPass,{
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    });
    engine.setBatchGeometry(cubeBatch,cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);
    // ... [Keep your ECS data generation exactly the same!] ...
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
    engine.updateBatchData(cubeBatch,data, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * 14;
                const xPos = data[base + 1];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                data[base + 2] = originalYPositions[i] + waveOffset;
            }
            engine.updateBatchData(cubeBatch,data, MAX_INSTANCES);
        },
        destroy: () => {
            engine.clearPasses();
        }
    };
}