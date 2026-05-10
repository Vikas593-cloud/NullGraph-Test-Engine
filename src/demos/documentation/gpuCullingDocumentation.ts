import { DemoMetadata } from "../../types";

export const gpuCullingDocumentation: DemoMetadata = {
    title: "GPU Compute Culling",
    concepts: [
        "Compute Shaders",
        "GPU Culling",
        "Indirect Rendering",
        "Atomic Operations",
        "Hybrid Pipelines"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo introduces a hybrid Compute-to-Render pipeline to perform incredibly efficient <strong>GPU Culling</strong>. While the CPU still animates 10,000 instances, it passes them to a WebGPU Compute Shader first. This shader acts as a 'bouncer,' evaluating each instance. Only instances that meet a specific condition (in this case, having a Y-position above 0.0) are copied into a new buffer and queued for rendering via an Indirect Draw call."
        },
        {
            heading: "The Compute Shader (The Bouncer)",
            text: "The compute shader runs highly parallel threads to evaluate every instance. If an instance is above the 'waterline' (Y > 0.0), it uses an <code>atomicAdd</code> operation. This safely increments a shared instance counter across thousands of concurrent GPU threads without race conditions, and writes the surviving instance data into a dedicated <code>culledData</code> buffer.",
            code: `@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= 10000u) { return; }

    let base = idx * 14u;
    let yPos = sourceData[base + 2u]; 

    // Culling Logic: Only keep instances above Y=0
    if (yPos > 0.0) {
        // Safely increment the draw count for the indirect buffer
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let writeBase = writeIdx * 14u;

        // Copy surviving instance data to the culled buffer
        for(var i = 0u; i < 14u; i = i + 1u) {
            culledData[writeBase + i] = sourceData[base + i];
        }
    }
}`
        },
        {
            heading: "Indirect Draw Setup",
            text: "To bridge the compute and render passes without stalling the GPU to read the instance count back to the CPU, we use <strong>Indirect Rendering</strong>. We flag the batch as indirect and seed an <code>IndirectDrawArgs</code> buffer with the base geometry index count. The compute shader dynamically populates the <code>instanceCount</code> parameter in this exact buffer right before the render pass executes.",
            code: `// Create an Indirect Batch combining Compute and Render shaders
const cullingBatch = engine.createBatch(mainPass, {
    isIndirect: true, // Activate the hybrid pipeline
    computeShaderCode: computeShaderCode,
    shaderCode: renderShaderCode,
    strideFloats: 14,
    maxInstances: MAX_INSTANCES,
    vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
});

// Seed the indirect buffer so the GPU knows how many vertices per instance to draw
const initialDrawArgs = new Uint32Array([cubeGeom.indices.length, 0, 0, 0, 0]);
engine.device.queue.writeBuffer(cullingBatch.indirectBuffer!, 0, initialDrawArgs);`
        },
        {
            heading: "Seamless Render Integration",
            text: "Because of the hybrid pipeline abstraction, the render vertex shader doesn't even need to know the culling occurred. The engine automatically maps the <code>culledData</code> buffer to the standard <code>ecs</code> binding. The vertex shader simply runs as normal, perfectly scaled to the new, dynamically reduced instance count.",
            code: `// The render shader remains blissfully unaware of the compute pass!
@group(0) @binding(1) var<storage, read> ecs: array<f32>; // Automatically binds to 'culledData'

@vertex
fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
    let base = iIdx * 14u;
    let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
    
    // ... calculate position and color normally
}`
        }
    ]
};