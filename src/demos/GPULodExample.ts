// demos/GPULodExample.ts
import { NullGraph, Camera } from 'null-graph';
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupGPULOD(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    const cubeGeom= Primitives.createCube(StandardLayout,1.0,1.0,1.0)
    const pyrGeom=Primitives.createPyramid(StandardLayout,1.0,1.0,1.0)
    cubeGeom.upload(engine)
    pyrGeom.upload(engine)
    const mainPass = engine.createPass({
        name: 'GPU LOD Main Pass',
        isMainScreenPass: true
    });

    // --- 2. CAMERA-RELATIVE COMPUTE SHADER ---
    const generateComputeShader = (condition: string, colorModifier: string) => `
        struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
        
        // UPGRADED STRUCT: Now includes position!
        struct Camera { 
            viewProj: mat4x4<f32>,
            position: vec3<f32>,
            _pad: f32 
        };

        @group(0) @binding(0) var<uniform> camera: Camera; 
        @group(0) @binding(1) var<storage, read> sourceData: array<f32>;
        @group(0) @binding(2) var<storage, read_write> culledData: array<f32>;
        @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

        @compute @workgroup_size(64)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let idx = global_id.x;
            if (idx >= ${MAX_INSTANCES}u) { return; }

            let base = idx * 14u;
            let pos = vec3<f32>(sourceData[base + 1u], sourceData[base + 2u], sourceData[base + 3u]); 
            
            // THE MAGIC: Calculate distance from the moving camera!
            let dist = distance(pos, camera.position);

            if (${condition}) {
                let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
                let writeBase = writeIdx * 14u;
                for(var i = 0u; i < 14u; i = i + 1u) { culledData[writeBase + i] = sourceData[base + i]; }
                ${colorModifier}
            }
        }
    `;

    const renderShaderCode = `
        struct Camera { viewProj: mat4x4<f32>, position: vec3<f32>, _pad: f32 };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut { @builtin(position) pos: vec4<f32>, @location(0) color: vec3<f32>, @location(1) normal: vec3<f32> };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNormal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            out.color = color; out.normal = localNormal; return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
            let diffuse = max(dot(normal, normalize(vec3<f32>(1.0, 1.5, 0.5))), 0.0); 
            return vec4<f32>(color * (0.3 + diffuse), 1.0);
        }
    `;



    // BATCH A: High Poly (Keep if < 60 units from camera. Color Neon Pink)
    const highPolyBatch = engine.createBatch(mainPass,{
        isIndirect: true,
        computeShaderCode: generateComputeShader('dist < 60.0', 'culledData[writeBase + 11u] = 1.0; culledData[writeBase + 12u] = 0.1; culledData[writeBase + 13u] = 0.6;'),
        shaderCode: renderShaderCode, strideFloats: 14, maxInstances: MAX_INSTANCES, vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    });
    engine.device.queue.writeBuffer(highPolyBatch.indirectBuffer!, 0, new Uint32Array([cubeGeom.indices.length, 0, 0, 0, 0]));
    engine.setBatchGeometry(highPolyBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    // BATCH B: Low Poly (Keep if >= 60 units from camera. Color Dark Purple)
    const lowPolyBatch = engine.createBatch(mainPass,{
        isIndirect: true,
        computeShaderCode: generateComputeShader('dist >= 60.0', 'culledData[writeBase + 11u] = 0.3; culledData[writeBase + 12u] = 0.1; culledData[writeBase + 13u] = 0.5;'),
        shaderCode: renderShaderCode, strideFloats: 14, maxInstances: MAX_INSTANCES, vertexLayouts:pyrGeom.layout.getWebGPUDescriptor()
    });
    engine.device.queue.writeBuffer(lowPolyBatch.indirectBuffer!, 0, new Uint32Array([pyrGeom.indices.length, 0, 0, 0, 0]));
    engine.setBatchGeometry(lowPolyBatch, pyrGeom.vertexBuffer!, pyrGeom.indexBuffer!, pyrGeom.indices.length);

    // --- 3. ECS DATA ---
    const data = new Float32Array(MAX_INSTANCES * 14);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 14;
        // Spread the objects much wider (radius 200) so the camera flies *through* them
        data[base + 1] = (Math.random() - 0.5) * 400; // X
        data[base + 2] = (Math.random() - 0.5) * 40;  // Y
        data[base + 3] = (Math.random() - 0.5) * 400; // Z
        data[base + 8] = 1.0; data[base + 9] = 1.0; data[base + 10] = 1.0;
    }

    return {
        update: (simTime: number) => {
            // We just send the static positions.
            // Since the Camera is moving in main.ts, the GPU will dynamically re-evaluate the LOD every frame!
            engine.updateBatchData(highPolyBatch, data, MAX_INSTANCES);
            engine.updateBatchData(lowPolyBatch, data, MAX_INSTANCES);
        },
        destroy: () => { engine.clearPasses(); }
    };
}