import { DemoMetadata } from "../../types";

export const arrayOfStructsDocumentation: DemoMetadata = {
    title: "Array of Structs (AoS) Instancing",
    concepts: [
        "Memory Layouts (AoS)",
        "Instanced Rendering",
        "Diffuse Lighting",
        "Buffer Streaming",
        "Procedural Animation"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo explores the <strong>Array of Structs (AoS)</strong> memory pattern for managing large-scale instanced rendering. It animates 10,000 3D cubes by packing their transform and color data into a single, interleaved floating-point array. The CPU efficiently updates procedural wave animations across this flat buffer and streams it directly to the GPU, which then applies directional lighting."
        },
        {
            heading: "AoS Pipeline & Batch Setup",
            text: "The rendering batch is configured to expect our AoS layout. We explicitly define a <code>strideFloats</code> of 14, meaning the GPU will jump exactly 14 floats in the storage buffer to find the data for the next instance. The geometry is also bound to this specific render batch.",
            code: `const cubeBatch = engine.createBatch(mainPass, {
    shaderCode: shaderSource,
    strideFloats: 14, // 14 floats per instance in our AoS layout
    maxInstances: 10000,
    vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
});

// Explicitly bind the geometry VBO and IBO to the batch
engine.setBatchGeometry(cubeBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);`
        },
        {
            heading: "Data Generation & Streaming",
            text: "All instance data is generated as a flat 1D <code>Float32Array</code>. In an AoS layout, an entity's properties (like X, Y, Z position and R, G, B color) sit directly next to each other in memory. We cache the original Y positions to use as a baseline for our sine wave animation, then upload the initial buffer to the GPU.",
            code: `// Generate flat, interleaved AoS data
const data = generateDummyData(10000, 14);
const originalYPositions = new Float32Array(10000);

// Cache the starting height for the wave animation
for (let i = 0; i < 10000; i++) {
    originalYPositions[i] = data[i * 14 + 2]; 
}

// Stream the initial buffer to the GPU
engine.updateBatchData(cubeBatch, data, 10000);`
        },
        {
            heading: "CPU Animation Loop",
            text: "During the render loop, the CPU iterates through the flat AoS array to update the heights dynamically. By recalculating the Y-position at the specific memory offset (<code>base + 2</code>), we create a procedural wave effect before re-uploading the modified array.",
            code: `update: (simTime: number) => {
    for (let i = 0; i < 10000; i++) {
        const base = i * 14;
        const xPos = data[base + 1];
        
        // Calculate new Y offset based on time, X position, and UI amplitude
        const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * getUiState().amplitude;
        data[base + 2] = originalYPositions[i] + waveOffset;
    }
    // Stream the updated frame data to the GPU
    engine.updateBatchData(cubeBatch, data, 10000);
}`
        },
        {
            heading: "Fragment Shader & Lighting",
            text: "The fragment shader calculates basic diffuse lighting to give the cubes 3D depth. It normalizes the incoming vertex normals and calculates the dot product against a fixed directional light vector. An ambient light value ensures the unlit faces remain visible.",
            code: `@fragment
fn fs_main(@location(0) color: vec3<f32>, @location(1) vertexNormals: vec3<f32>) -> @location(0) vec4<f32> {
    // Normalization for lighting calculations
    let N = normalize(vertexNormals);
    
    // Direction of light vector
    let lightDir = normalize(vec3<f32>(1.0, 2.0, 0.5));
    
    // Calculate strength of direct light
    let diffuseStrength = max(dot(N, lightDir), 0.0);
    
    // Base ambient light so shadowed faces aren't completely black
    let ambientLight = 0.2;
    let totalLight = ambientLight + diffuseStrength;
    
    let finalColor = color * totalLight;
    
    return vec4<f32>(finalColor, 1.0);
}`
        }
    ]
};