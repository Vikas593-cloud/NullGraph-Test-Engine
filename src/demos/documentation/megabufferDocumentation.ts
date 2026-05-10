import { DemoMetadata } from "../../types";

export const megabufferDocumentation: DemoMetadata = {
    title: "Megabuffers & Zero-Upload Rendering",
    concepts: [
        "Megabuffers",
        "Memory Slicing",
        "Shared Storage Buffers",
        "Indirect Draw Offsets",
        "GPU-Driven Animation"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo represents the pinnacle of WebGPU performance optimization. It renders an asteroid field of 100,000 instances composed of 50 completely unique procedural geometries. To achieve this without melting the CPU, the demo utilizes a 'Megabuffer' architecture, memory slicing, and pure GPU-driven animation to completely eliminate per-frame data uploads."
        },
        {
            heading: "The Megabuffer Concept",
            text: "Switching vertex and index buffers mid-render (context switching) is expensive for the GPU. A Megabuffer solves this by concatenating the vertices and indices of all 50 unique meshes into one massive VBO and IBO. When configuring the indirect render batches, we simply point the <code>baseVertex</code> and <code>firstIndex</code> arguments to the specific memory segment where that mesh's geometry resides.",
            code: `const builder = new MegabufferBuilder(6);

// 1. Pack 50 unique meshes into one massive buffer
for (let i = 0; i < UNIQUE_MESH_COUNT; i++) {
    const mesh = generateProceduralAsteroid(sides, 2.0, isCrystal);
    builder.addMesh(\`SpaceDebris_\${i}\`, mesh.v, mesh.i);
}

// ...

// 2. Point the indirect draw call to the correct mesh offset
const offset = builder.getOffset(\`SpaceDebris_\${i}\`);
engine.device.queue.writeBuffer(batch.indirectBuffer!, 0, new Uint32Array([
    offset.indexCount, 0, offset.firstIndex, offset.baseVertex, 0
]));`
        },
        {
            heading: "Shared Storage & Memory Slicing",
            text: "Instead of managing 50 separate ECS data arrays, all 100,000 instances are stored in a single <strong>Shared Source Buffer</strong>. The data is logically grouped (pre-sorted) by mesh ID. The compute shader factory dynamically generates a shader for each batch that only reads a specific 'slice' of this master array using a predefined <code>startIndex</code>, preventing redundant processing.",
            code: `// Generate a compute shader scoped to a specific memory slice
const generateComputeShader = (startIndex: number, count: number) => \`
    // ...
    @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let local_idx = global_id.x;
        
        // Only process the 2,000 instances assigned to this batch
        if (local_idx >= \${count}u) { return; } 

        // Shift the read index to this specific batch's slice in the shared buffer!
        let actual_idx = local_idx + \${startIndex}u;
        let base = actual_idx * 16u; 
        
        // ... fetch data and perform distance culling
    }
\`;`
        },
        {
            heading: "Pure GPU-Driven Animation",
            text: "To eliminate the CPU bottleneck entirely, all animation logic is moved to the Vertex Shader. The ECS data now includes rotational axes and speeds for each asteroid. Using the elapsed time passed via the camera uniform, the vertex shader mathematically rotates the local vertices and normals on the fly before projecting them into world space.",
            code: `// Helper to rotate vertices mathematically on the GPU
fn rotate(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
    let s = sin(angle); let c = cos(angle); let ic = 1.0 - c;
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * ic;
}

@vertex
fn vs_main(...) -> VertexOut {
    // ... fetch axis, speed, scale, pos from buffer
    
    // GPU-Driven animation!
    let animatedPos = rotate(localPos * scale, normalize(axis), camera.time * speed);
    let animatedNorm = rotate(localNormal, normalize(axis), camera.time * speed);

    var out: VertexOut;
    out.pos = camera.viewProj * vec4<f32>(animatedPos + pos, 1.0);
    out.normal = animatedNorm; 
    return out;
}`
        },
        {
            heading: "Zero-Cost CPU Update Loop",
            text: "Because culling is handled by the compute shader and animation is handled by the vertex shader, the CPU update loop becomes virtually empty. The massive 100,000-instance float array is uploaded exactly once during initialization. Every frame, the CPU simply advances the time uniform and tells the engine how many compute threads to dispatch.",
            code: `update: (simTime: number) => {
    // Hijack the camera's padding float to pass "time" to the shaders
    camera.bufferData[19] = simTime * 0.1;

    // Just tell NullGraph to dispatch compute threads
    // ZERO buffer uploads happen here!
    for(const batch of allBatches) {
        batch.currentInstanceCount = INSTANCES_PER_MESH;
    }
}`
        }
    ]
};