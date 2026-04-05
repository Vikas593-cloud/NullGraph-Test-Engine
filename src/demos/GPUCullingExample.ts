// demos/GPUCullingExample.ts
import { NullGraph, Camera } from 'null-graph';
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupGPUCulling(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    const mainPass = engine.createPass({
        name: 'GPU Culling Main Pass',
        isMainScreenPass: true
    });

    const cubeGeom=Primitives.createCube(StandardLayout,1.0,1.0,1.0)
    cubeGeom.upload(engine)
    // The Compute Shader (The GPU Bouncer)
    const computeShaderCode = `
        struct IndirectDrawArgs {
            indexCount: u32,
            instanceCount: atomic<u32>, 
            firstIndex: u32,
            baseVertex: u32, // Note: WebGPU technically expects i32 here, but u32 memory maps exactly the same
            firstInstance: u32,
        };

        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera; 
        
        @group(0) @binding(1) var<storage, read> sourceData: array<f32>;
        @group(0) @binding(2) var<storage, read_write> culledData: array<f32>;
        @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

        @compute @workgroup_size(64)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let idx = global_id.x;
            if (idx >= ${MAX_INSTANCES}u) { return; }

            // THE FIX: Trick the compiler into keeping Binding 0 alive!
            let _keepCameraAlive = camera.viewProj[0][0];

            let base = idx * 14u;
            let yPos = sourceData[base + 2u]; 

            if (yPos > 0.0) {
                let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
                let writeBase = writeIdx * 14u;

                for(var i = 0u; i < 14u; i = i + 1u) {
                    culledData[writeBase + i] = sourceData[base + i];
                }
            }
        }
    `;

    // 3. The Render Shader (Same as your previous demo)
    const renderShaderCode = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>; // Note: This will automatically bind to 'culledData' now!

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
            @location(1) normal: vec3<f32>,
        };

        @vertex
        fn vs_main(
            @location(0) localPos: vec3<f32>,
            @location(1) localNormal: vec3<f32>,
            @builtin(instance_index) iIdx: u32
        ) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            out.color = color;
            out.normal = localNormal;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
            let sunDir = normalize(vec3<f32>(1.0, 1.5, 0.5));
            let diffuse = max(dot(normal, sunDir), 0.0); 
            return vec4<f32>(color * (0.3 + diffuse), 1.0);
        }
    `;

    // 4. Create the Indirect Batch!
    const cullingBatch = engine.createBatch(mainPass,{
        isIndirect: true, // Activate the hybrid pipeline!
        computeShaderCode: computeShaderCode,
        shaderCode: renderShaderCode,
        strideFloats: 14,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
    });

    // WebGPU requires us to seed the indirect buffer with the index count initially
    const initialDrawArgs = new Uint32Array([cubeGeom.indices.length, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(cullingBatch.indirectBuffer!, 0, initialDrawArgs);

    engine.setBatchGeometry(cullingBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);

    // 5. Generate Initial ECS Data
    const data = new Float32Array(MAX_INSTANCES * 14);
    const originalYPositions = new Float32Array(MAX_INSTANCES);

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 14;
        data[base + 1] = (Math.random() - 0.5) * 100;
        data[base + 2] = (Math.random() - 0.5) * 5; // Tighter vertical grouping
        data[base + 3] = (Math.random() - 0.5) * 100;
        originalYPositions[i] = data[base + 2];

        data[base + 8] = 1.0; data[base + 9] = 1.0; data[base + 10] = 1.0;

        // Let's make them all a nice neon blue/green so they look like a digital sea
        data[base + 11] = 0.1; data[base + 12] = 0.8 + Math.random() * 0.2; data[base + 13] = 0.8;
    }

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // CPU ANIMATION: We still animate everything here
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * 14;
                const xPos = data[base + 1];
                const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
                data[base + 2] = originalYPositions[i] + waveOffset;
            }

            // Send to the Source Buffer (The GPU will handle the culling!)
            engine.updateBatchData(cullingBatch, data, MAX_INSTANCES);
        },
        destroy: () => {
            engine.clearPasses();
        }
    };
}