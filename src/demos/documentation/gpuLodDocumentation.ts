import { DemoMetadata } from "../../types";

export const gpuLodDocumentation: DemoMetadata = {
    title: "GPU Level of Detail (LOD)",
    concepts: [
        "Level of Detail (LOD)",
        "Compute Shaders",
        "Camera Distance Math",
        "Indirect Rendering",
        "Multi-Batch Routing"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo implements a purely GPU-driven <strong>Level of Detail (LOD)</strong> system. It uses a compute shader to calculate the distance from every instance to the moving camera. Based on this distance, the GPU dynamically sorts each instance into either a 'High Poly' render batch (cubes) or a 'Low Poly' render batch (pyramids). To make the transition obvious, the compute shader also overrides the colors."
        },
        {
            heading: "Camera-Aware Compute Shader",
            text: "To evaluate LOD, the compute shader needs real-time access to the camera's spatial coordinates. The camera uniform struct is expanded to include the camera's world <code>position</code>. The shader then uses the built-in <code>distance()</code> function to measure how far each instance is from the viewer before deciding whether to keep it.",
            code: `// UPGRADED STRUCT: Now includes camera position
struct Camera { 
    viewProj: mat4x4<f32>,
    position: vec3<f32>,
    _pad: f32 
};

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // ... bounds checking and data fetching ...

    let pos = vec3<f32>(sourceData[base + 1u], sourceData[base + 2u], sourceData[base + 3u]); 
    
    // THE MAGIC: Calculate distance from the moving camera!
    let dist = distance(pos, camera.position);

    if (/* Condition dynamically injected based on LOD tier */) {
        // Atomic append to the indirect draw buffer...
    }
}`
        },
        {
            heading: "Multi-Batch Routing & Code Generation",
            text: "Instead of writing duplicate compute shaders, a JavaScript factory function dynamically generates them based on a condition string. The engine sets up two separate indirect render batches: one for close objects (<code>dist < 60.0</code>) bound to cube geometry, and one for distant objects (<code>dist >= 60.0</code>) bound to pyramid geometry.",
            code: `// BATCH A: High Poly (Keep if < 60 units from camera. Color Neon Pink)
const highPolyBatch = engine.createBatch(mainPass, {
    isIndirect: true,
    computeShaderCode: generateComputeShader(
        'dist < 60.0', 
        'culledData[writeBase + 11u] = 1.0; culledData[writeBase + 12u] = 0.1; culledData[writeBase + 13u] = 0.6;'
    ),
    shaderCode: renderShaderCode, strideFloats: 14, maxInstances: MAX_INSTANCES, 
    vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
});

// BATCH B: Low Poly (Keep if >= 60 units from camera. Color Dark Purple)
const lowPolyBatch = engine.createBatch(mainPass, {
    isIndirect: true,
    computeShaderCode: generateComputeShader(
        'dist >= 60.0', 
        'culledData[writeBase + 11u] = 0.3; culledData[writeBase + 12u] = 0.1; culledData[writeBase + 13u] = 0.5;'
    ),
    // ... bounds to pyrGeom
});`
        },
        {
            heading: "Zero-Cost CPU Loop",
            text: "Because the sorting and culling logic is entirely offloaded to the GPU, the CPU does virtually no work during the application's update loop. The same master array of unculled instance data is fed into both batches simultaneously. As the camera moves, the compute shaders automatically recalculate the distances and populate their respective draw buffers on the fly.",
            code: `update: (simTime: number) => {
    // We just send the static positions.
    // Since the Camera is moving, the GPU will dynamically re-evaluate the LOD every frame!
    
    engine.updateBatchData(highPolyBatch, data, MAX_INSTANCES);
    engine.updateBatchData(lowPolyBatch, data, MAX_INSTANCES);
}`
        }
    ]
};