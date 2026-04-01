// demos/MegabufferExample.ts
import {NullGraph, Camera, MegabufferBuilder, RenderBatch} from 'null-graph';
import {GeometryBuilder, StandardLayout} from "null-graph/geometry";

// --- PROCEDURAL GEOMETRY GENERATORS ---
function generateProceduralAsteroid(numSides: number, radius: number, isCrystal: boolean) {
    const builder = new GeometryBuilder(StandardLayout);
    const heightMult = isCrystal ? 2.5 : 1.0;

    // 1. Add Top and Bottom points
    const topIdx = builder.addVertex({
        position: [0, radius * heightMult, 0],
        normal: [0, 1, 0],
        uv: [0.5, 1.0]
    });

    const btmIdx = builder.addVertex({
        position: [0, -radius * heightMult, 0],
        normal: [0, -1, 0],
        uv: [0.5, 0.0]
    });

    // 2. Add the middle ring
    const ringStartIdx = topIdx + 2; // The next vertex added will be index 2

    for (let i = 0; i < numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2;
        // Crystals are sharper, asteroids are rounder
        const r = radius * (isCrystal ? (0.3 + Math.random() * 0.7) : (0.7 + Math.random() * 0.3));
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        builder.addVertex({
            position: [x, (Math.random() - 0.5) * radius * 0.5, z],
            normal: [x, 0.5, z], // Keeping your original radial normal logic
            uv: [i / numSides, 0.5]
        });
    }

    // 3. Stitch the indices together
    for (let i = 0; i < numSides; i++) {
        const next = (i + 1) % numSides;

        // Top half triangle
        builder.addTriangle(topIdx, ringStartIdx + i, ringStartIdx + next);

        // Bottom half triangle
        builder.addTriangle(btmIdx, ringStartIdx + next, ringStartIdx + i);
    }

    // Returns { v: Float32Array, i: Uint16Array }
    return builder.build();
}

export async function setupMegabuffer(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 100000; // Let's push it!
    const UNIQUE_MESH_COUNT = 50; // 50 entirely different models

    const builder = new MegabufferBuilder(6);
    const mainPass = engine.createPass({
        name: 'Mega Buffer Main Pass',
        isMainScreenPass: true
    });

    // 1. Pack 50 unique meshes into the Megabuffer
    for (let i = 0; i < UNIQUE_MESH_COUNT; i++) {
        const sides = 5 + Math.floor(Math.random() * 10);
        const isCrystal = Math.random() > 0.7; // 30% chance to be a tall crystal
        const mesh = generateProceduralAsteroid(sides, 2.0, isCrystal);
        builder.addMesh(`SpaceDebris_${i}`, mesh.v, mesh.i);
    }

    const megaData = builder.build();
    const vboMega = engine.bufferManager.createVertexBuffer(megaData.megaVertices);
    const iboMega = engine.bufferManager.createIndexBuffer(megaData.megaIndices);

    // 2. CREATE THE MASTER SHARED BUFFER
    // This prevents the CPU/PCIe bottleneck!
    const sharedSourceBuffer = engine.device.createBuffer({
        size: MAX_INSTANCES * 16 * 4, // Upgraded stride to 16 for better alignment
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // --- COMPUTE & RENDER SHADERS ---
    // Stride is 16.
    // [1,2,3] = Pos, [4,5,6] = RotAxis, [7] = RotSpeed, [8,9,10] = Scale, [11,12,13] = Color, [14] = MeshID
    // Notice the new parameters!
    const generateComputeShader = (startIndex: number, count: number) => `
        struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
        struct Camera { viewProj: mat4x4<f32>, position: vec3<f32>, time: f32 };

        @group(0) @binding(0) var<uniform> camera: Camera; 
        @group(0) @binding(1) var<storage, read> sourceData: array<f32>;
        @group(0) @binding(2) var<storage, read_write> culledData: array<f32>;
        @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

        @compute @workgroup_size(64)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let local_idx = global_id.x;
            if (local_idx >= ${count}u) { return; } // Only process 2,000 max!

            // Shift the read index to this specific batch's slice!
            let actual_idx = local_idx + ${startIndex}u;
            let base = actual_idx * 16u; 
            
            let pos = vec3<f32>(sourceData[base+1u], sourceData[base+2u], sourceData[base+3u]);
            let dist = distance(pos, camera.position);
            
            // We removed the targetMeshID check because the data is pre-sorted!
            if (dist < 600.0) {
                let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
                let writeBase = writeIdx * 16u;
                for(var i = 0u; i < 16u; i = i + 1u) { culledData[writeBase + i] = sourceData[base + i]; }
            }
        }
    `;

    const renderShaderCode = `
        struct Camera { viewProj: mat4x4<f32>, position: vec3<f32>, time: f32 };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;
        
        struct VertexOut { @builtin(position) pos: vec4<f32>, @location(0) color: vec3<f32>, @location(1) normal: vec3<f32> };

        // Helper to rotate vertices on the GPU
        fn rotate(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
            let s = sin(angle); let c = cos(angle); let ic = 1.0 - c;
            return v * c + cross(axis, v) * s + axis * dot(axis, v) * ic;
        }

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNormal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 16u;
            let pos = vec3<f32>(ecs[base+1u], ecs[base+2u], ecs[base+3u]);
            let axis = vec3<f32>(ecs[base+4u], ecs[base+5u], ecs[base+6u]);
            let speed = ecs[base+7u];
            let scale = vec3<f32>(ecs[base+8u], ecs[base+9u], ecs[base+10u]);
            let color = vec3<f32>(ecs[base+11u], ecs[base+12u], ecs[base+13u]);
            
            // GPU-Driven animation!
            let animatedPos = rotate(localPos * scale, normalize(axis), camera.time * speed);
            let animatedNorm = rotate(localNormal, normalize(axis), camera.time * speed);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(animatedPos + pos, 1.0);
            out.color = color; 
            out.normal = animatedNorm; 
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(1.0, 2.0, 0.5));
            let diffuse = max(dot(normal, lightDir), 0.0); 
            let ambient = 0.2;
            return vec4<f32>(color * (ambient + diffuse), 1.0);
        }
    `;

    const vertexLayout = {
        arrayStride: 24, attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat},
            {shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat}
        ]
    };

    // 3. CREATE BATCHES DYNAMICALLY
    const allBatches: RenderBatch[] = [];

    const INSTANCES_PER_MESH = MAX_INSTANCES / UNIQUE_MESH_COUNT; // 100,000 / 50 = 2,000

    for(let i = 0; i < UNIQUE_MESH_COUNT; i++) {
        const offset = builder.getOffset(`SpaceDebris_${i}`);
        const startIndex = i * INSTANCES_PER_MESH; // Calculate where this mesh's data begins

        const batch = engine.createBatch(mainPass,{
            isIndirect: true,
            computeShaderCode: generateComputeShader(startIndex, INSTANCES_PER_MESH), // Pass the slice bounds
            shaderCode: renderShaderCode,
            strideFloats: 16,
            maxInstances: MAX_INSTANCES,
            vertexLayouts: [vertexLayout],
            sharedSourceBuffer: sharedSourceBuffer
        });

        engine.device.queue.writeBuffer(batch.indirectBuffer!, 0, new Uint32Array([offset.indexCount, 0, offset.firstIndex, offset.baseVertex, 0]));
        engine.setBatchGeometry(batch, vboMega, iboMega, megaData.megaIndices.length, megaData.indexFormat);
        allBatches.push(batch);
    }

    // 4. POPULATE ECS DATA (Upload Once!)
    const data = new Float32Array(MAX_INSTANCES * 16);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 16;
        data[base + 1] = (Math.random() - 0.5) * 1200;
        data[base + 2] = (Math.random() - 0.5) * 400;
        data[base + 3] = (Math.random() - 0.5) * 1200;

        data[base + 4] = Math.random() - 0.5;
        data[base + 5] = Math.random() - 0.5;
        data[base + 6] = Math.random() - 0.5;
        data[base + 7] = (Math.random() * 2.0) - 1.0;

        const s = 0.5 + Math.random() * 2.0;
        data[base + 8] = s; data[base + 9] = s; data[base + 10] = s;

        data[base + 11] = Math.random() * 0.5;
        data[base + 12] = 0.5 + Math.random() * 0.5;
        data[base + 13] = 0.8 + Math.random() * 0.2;

        // Group them logically instead of randomly!
        data[base + 14] = Math.floor(i / INSTANCES_PER_MESH);
    }

    // ONE-TIME UPLOAD
    engine.device.queue.writeBuffer(sharedSourceBuffer, 0, data.buffer, data.byteOffset, MAX_INSTANCES * 16 * 4);

    return {
        update: (simTime: number) => {
            // Hijack the camera's padding float to pass "time" to the shaders
            // Since camera.bufferData is a Float32Array, index 19 is the 20th float (the padding).
            camera.bufferData[19] = simTime * 0.1;

            // Just tell NullGraph to dispatch compute threads, no data upload!
            for(const batch of allBatches) {
                batch.currentInstanceCount = INSTANCES_PER_MESH;
            }
        },
        destroy: () => {
            engine.clearPasses();
            sharedSourceBuffer.destroy();
        }
    };
}