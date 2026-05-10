import { DemoMetadata } from "../../types";

export const aosoaDocumentation: DemoMetadata = {
    title: "Array of Structs of Arrays (AoSoA)",
    concepts: [
        "Memory Layouts (AoSoA)",
        "Cache Coherency",
        "SIMD-friendly Loops",
        "Bitwise Shader Math",
        "Instanced Rendering"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo implements the <strong>Array of Structs of Arrays (AoSoA)</strong> memory layout to manage 10,000 instanced octahedrons. By grouping data into chunks of 16 instances, it combines the tight property packing of SoA with the localized spatial organization of AoS. This hybrid approach makes CPU-side procedural animations highly cache-efficient and ready for SIMD vectorization."
        },
        {
            heading: "Chunked Data Generation",
            text: "Data is organized into small chunks (in this case, 16 instances). Within each chunk, identical properties are stored contiguously. For example, all 16 X-positions sit sequentially in memory, followed immediately by 16 Y-positions. This ensures that when the CPU updates a specific property, it loads the entire sequence into the CPU cache at once.",
            code: `// Loop through the 16 items in this specific chunk
for (let i = 0; i < CHUNK_SIZE; i++) {
    const globalIdx = (c * CHUNK_SIZE) + i;
    if (globalIdx >= MAX_INSTANCES) break;

    // Property 1, 2, 3: Position (Stored contiguously within the chunk)
    data[chunkBase + (1 * CHUNK_SIZE) + i] = (Math.random() - 0.5) * 100; // X
    data[chunkBase + (2 * CHUNK_SIZE) + i] = startY;                      // Y
    data[chunkBase + (3 * CHUNK_SIZE) + i] = (Math.random() - 0.5) * 100; // Z
}`
        },
        {
            heading: "Fast Bitwise Shader Decoding",
            text: "To read this complex memory layout, the GPU must calculate both the chunk index and the local offset for each instance. Standard division and modulo operators can be expensive in shaders. Because our chunk size (16) is a power of two, we can use incredibly fast bitwise operations to instantly decode these values.",
            code: `@vertex
fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
    let CHUNK_SIZE = 16u;
    let CHUNK_FLOATS = 224u; // 16 * 14
    
    // FAST MATH: iIdx / 16 = iIdx >> 4; iIdx % 16 = iIdx & 15;
    let chunkIdx = iIdx >> 4u; 
    let localIdx = iIdx & 15u; 
    let chunkBase = chunkIdx * CHUNK_FLOATS;

    // Memory fetch (Chunk Base + (Property Index * Chunk Size) + Local Offset)
    let px = ecs[chunkBase + (1u * CHUNK_SIZE) + localIdx];
    // ...
}`
        },
        {
            heading: "SIMD-Friendly CPU Loop",
            text: "During the update loop, the CPU iterates over the data chunk by chunk. The base memory offsets for specific arrays (like X and Y positions) are calculated outside the inner loop. The inner loop then simply sweeps sequentially through 16 contiguous memory addresses, a pattern that modern CPU branch predictors and prefetchers handle flawlessly.",
            code: `// We iterate chunk by chunk, maximizing CPU cache efficiency.
for (let c = 0; c < numChunks; c++) {
    const chunkBase = c * CHUNK_FLOATS;
    const pxOffset = chunkBase + (1 * CHUNK_SIZE); // Jump to X array in this chunk
    const pyOffset = chunkBase + (2 * CHUNK_SIZE); // Jump to Y array in this chunk

    // SIMD-friendly inner loop (contiguous memory access)
    for (let i = 0; i < CHUNK_SIZE; i++) {
        const globalIdx = (c * CHUNK_SIZE) + i;
        if (globalIdx >= MAX_INSTANCES) break;

        const xPos = data[pxOffset + i];
        const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
        data[pyOffset + i] = originalYPositions[globalIdx] + waveOffset;
    }
}`
        }
    ]
};