import { DemoMetadata } from "../../../types";

export const glbInstancingDocumentation: DemoMetadata = {
    title: "Custom 3D Models & Interleaved Buffers",
    concepts: [
        "GLB/glTF Parsing",
        "Interleaved Vertex Layouts",
        "Buffer Management",
        "Diffuse Directional Lighting",
        "Instanced Rendering"
    ],
    sections: [
        {
            heading: "Overview: Breaking Out of Procedural Geometry",
            isOpen: true,
            text: "While procedural shapes (like cubes and pyramids) are great for testing, real engines need to load custom 3D assets. This demo bridges the gap between a 3D modeling tool (like Blender) and the WebGPU pipeline by parsing a binary <strong>GLB</strong> file, mapping its raw geometry into VRAM, and instancing it 10,000 times."
        },
        {
            heading: "1. Parsing & Buffer Management",
            text: "A GLB file contains binary blobs of vertex data. Our <code>GLBParser</code> extracts the Positions, Normals, and UV coordinates and packs them into a single, flat <code>Float32Array</code>. We then use the engine's <code>BufferManager</code> to securely allocate standard WebGPU Vertex and Index buffers in VRAM.",
            code: `// Extract the first mesh from the loaded GLB
const monkeyMesh = glbData[0];

// Securely allocate VRAM and map the Float32/Uint data
const vertexBuffer = engine.bufferManager.createVertexBuffer(monkeyMesh.vertices);
const indexBuffer = engine.bufferManager.createIndexBuffer(monkeyMesh.indices);`
        },
        {
            heading: "2. Interleaved Vertex Layouts",
            text: "Because our parser packed Position (x,y,z), Normal (x,y,z), and UV (u,v) sequentially, each vertex takes up exactly 8 floats (32 bytes). We must explicitly define a <strong>GPUVertexBufferLayout</strong> so the WebGPU shader knows exactly how to slice and read this continuous stream of memory.",
            code: `// Defining a 32-byte stride layout
const monkeyVertexLayout: GPUVertexBufferLayout[] = [{
    arrayStride: 32, // 8 floats * 4 bytes per float
    attributes: [
        { format: 'float32x3', offset: 0, shaderLocation: 0 },  // Position
        { format: 'float32x3', offset: 12, shaderLocation: 1 }, // Normal
        { format: 'float32x2', offset: 24, shaderLocation: 2 }  // UV
    ]
}];`
        },
        {
            heading: "3. Diffuse Directional Lighting",
            text: "Without lighting, 10,000 monkeys would look like flat, solid-colored silhouettes. By passing the <code>@location(1) normal</code> into our vertex shader, we can calculate how much light hits each face based on its angle. We use a simple <strong>Dot Product</strong> between the normal and a fixed light direction to create realistic shadows and depth.",
            code: `// Simple directional lighting in WGSL
@vertex
fn vs_main(
    @location(0) localPos: vec3<f32>,   
    @location(1) normal: vec3<f32>,
    /* ... */
) -> VertexOut {
    /* ... position calculations ... */
    
    // Define a light pointing down and slightly forward
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
    let ambient = 0.3;
    
    // Calculate light intensity based on surface angle
    let diffuse = max(dot(normal, lightDir), 0.0);
    let lighting = ambient + (diffuse * 0.7);

    out.color = color * lighting; 
    return out;
}`
        },
        {
            heading: "4. CPU Instancing & Animation",
            text: "Just like procedural shapes, we power the swarm using an ECS (Entity Component System) float array. The CPU iterates through the 10,000 instances, applies a sine wave offset to their Y-positions based on their X-positions, and streams the updated transforms directly to the GPU's storage buffer every frame."
        }
    ]
};