import {DemoMetadata} from "../../types";


export const dynamicGeometryDocumentation: DemoMetadata = {
    title: "Dynamic Geometry Streaming (Megabuffer)",
    concepts: [
        "Memory Management",
        "Free-List Allocation",
        "DMA Data Streaming",
        "Indirect Rendering",
        "Compute Culling"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "In modern graphics APIs like WebGPU, destroying or resizing buffers mid-frame causes massive pipeline stalls and frame drops. This demo solves that by implementing a <strong>Geometry Sub-Allocator</strong>. We pre-allocate a massive 'Megabuffer' upfront, and use a CPU-side tracker to dynamically slot new geometry in and out of the GPU's memory without ever pausing the render loop."
        },
        {
            heading: "The Free-List Allocator",
            text: "To prevent memory fragmentation when we delete geometry, our <code>DynamicGeometryManager</code> uses a Free-List allocation strategy. It tracks 'blocks' of empty space inside the VBO, IBO, and Instance buffers. When a mesh is removed, its memory block is returned to the pool. When a new mesh is generated, it seamlessly slides into the recycled space.",
            code: `// Claiming an instance block for a new mesh
if (freeInstanceBlocks.length === 0) {
    console.warn("Max instances reached!");
    return; 
}
const startIndex = freeInstanceBlocks.pop(); 

// ... (Create geometry and draw batch) ...

// Returning the block when the mesh is deleted
freeInstanceBlocks.push(record.startIndex);`
        },
        {
            heading: "Zero-Stall DMA Uploads",
            text: "Because our buffers are pre-allocated, we bypass expensive <code>getMappedRange()</code> calls. Instead, we use <strong>Direct Memory Access (DMA)</strong> to stream binary data asynchronously. By using <code>queue.writeBuffer()</code>, we can inject a few kilobytes of vertex, index, and transform data directly into a specific byte-offset of the Megabuffer without locking the CPU or stalling the GPU.",
            code: `// Dynamically inject indices at a specific byte offset
const indices32 = new Uint32Array(mesh.i);
const indexBytes = 4; // 32-bit indices
const iboOffsetBytes = offset.firstIndex * indexBytes;

engine.device.queue.writeBuffer(
    geomManager.ibo, 
    iboOffsetBytes, 
    indices32.buffer
);`
        },
        {
            heading: "Compute Slice Alignment",
            text: "Because multiple unique meshes share the same giant <code>sharedSourceBuffer</code> for their ECS transforms, the Compute Shader must be told exactly where to look. Each dynamic batch is compiled with a hardcoded <code>startIndex</code>, effectively slicing the master buffer into isolated 2,000-instance chunks so meshes don't overwrite each other.",
            code: `// Compute Shader indexing logic
@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let local_idx = global_id.x;
    if (local_idx >= \${count}u) { return; } 

    // Shift the read index to this specific batch's slice!
    let actual_idx = local_idx + \${startIndex}u;
    let base = actual_idx * 16u; 
    
    // ... calculate positions and culling ...
}`
        },
        {
            heading: "Indirect Drawing",
            text: "The CPU has no idea how many instances are actually visible on screen. Instead of the CPU issuing a <code>draw()</code> command, the Compute Shader evaluates every instance, packs the visible ones tightly into a culled buffer, and increments an atomic counter. The Render Pass uses <code>drawIndexedIndirect()</code> to read those arguments natively on the GPU."
        }
    ]
};