import { DemoMetadata } from "../../types";

export const soaDocumentation: DemoMetadata = {
    title: "Struct of Arrays (SoA)",
    concepts: [
        "Memory Layouts (SoA)",
        "CPU Cache Optimization",
        "Instanced Rendering",
        "Memory Offsets",
        "Buffer Streaming"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo shifts the memory architecture to a <strong>Struct of Arrays (SoA)</strong> layout for rendering 10,000 instanced pyramids. Instead of interleaving properties (like in AoS), all position vectors are grouped together in memory, followed by all scales, and then all colors. This layout heavily optimizes the CPU loop because updating the wave animation only requires loading the tightly packed position data into the CPU cache, safely ignoring scales and colors."
        },
        {
            heading: "Generating Memory Chunks",
            text: "The flat <code>Float32Array</code> is divided into three massive contiguous chunks. We calculate absolute offsets for Positions, Scales, and Colors based on the maximum number of instances. When initializing the data, the application populates these isolated regions.",
            code: `const POS_OFFSET = 0;
const SCALE_OFFSET = MAX_INSTANCES * 3;
const COLOR_OFFSET = MAX_INSTANCES * 6;

for (let i = 0; i < MAX_INSTANCES; i++) {
    const i3 = i * 3;

    // Positions (Chunk 1) - Tightly packed in memory
    data[POS_OFFSET + i3 + 0] = (Math.random() - 0.5) * 100; // X
    data[POS_OFFSET + i3 + 1] = startY;                      // Y
    data[POS_OFFSET + i3 + 2] = (Math.random() - 0.5) * 100; // Z

    // Scales (Chunk 2)
    data[SCALE_OFFSET + i3 + 0] = 1.0; 
    // ...
}`
        },
        {
            heading: "Reconstructing Data in the Shader",
            text: "Because the data is no longer interleaved, the vertex shader must calculate separate memory jumps to find the specific properties for the current instance. It uses the known <code>MAX_INSTANCES</code> uniform variable to stride across the massive array chunks and rebuild the instance's state.",
            code: `@vertex
fn vs_main(@location(0) localPos:vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
    let MAX_INSTANCES = 10000u;
    let i3 = iIdx * 3u;

    // Memory jumps for SoA chunking
    let posBase = i3;
    let scaleBase = (MAX_INSTANCES * 3u) + i3;
    let colorBase = (MAX_INSTANCES * 6u) + i3;

    // Read the contiguous data from isolated chunks
    let pos = vec3<f32>(ecs[posBase], ecs[posBase + 1u], ecs[posBase + 2u]);
    let scale = vec3<f32>(ecs[scaleBase], ecs[scaleBase + 1u], ecs[scaleBase + 2u]);
    let color = vec3<f32>(ecs[colorBase], ecs[colorBase + 1u], ecs[colorBase + 2u]);
    
    // ... calculate worldPos
}`
        },
        {
            heading: "Optimized CPU Update Loop",
            text: "The main advantage of SoA is realized in the update loop. Because we are only animating the Y-position, the CPU only loops over the first chunk of the array. The CPU cache is flooded purely with position data, resulting in fewer cache misses and significantly faster execution times compared to jumping across unneeded color and scale data.",
            code: `update: (simTime: number) => {
    const uiState = getUiState();

    // SUPER FAST CPU LOOP: We only iterate over the tightly packed Positions array!
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const i3 = i * 3;
        const xPos = data[POS_OFFSET + i3 + 0];
        const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
        data[POS_OFFSET + i3 + 1] = originalYPositions[i] + waveOffset;
    }
    
    // Stream the buffer to the GPU
    engine.updateBatchData(pyramidBatch, data, MAX_INSTANCES);
}`
        }
    ]
};

export const helloPBRCubeDocumentation: DemoMetadata = {
    title: "Hello PBR Cube",
    concepts: [
        "Physically Based Rendering (PBR)",
        "Material Pipelines",
        "Texture Fallbacks",
        "Camera Orbiting"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "A foundational demo showcasing the engine's <strong>Physically Based Rendering (PBR)</strong> capabilities. It renders a single, static cube using a standardized PBR material pipeline, leveraging the engine's built-in texture fallbacks to handle albedo, normal, and packed ARM (Ambient Occlusion, Roughness, Metallic) maps without needing external assets."
        },
        {
            heading: "PBR Material Setup",
            text: "The demo utilizes a <code>StandardPBRMaterial</code> class to encapsulate complex lighting properties. By assigning the engine's default fallback textures, we guarantee the shader has valid data to read. We also apply a base 'NullGraph Blue' color and tweak the metallic and roughness multipliers to give the cube a distinct surface finish.",
            code: `// Setup Material (Using built-in fallbacks)
const material = new StandardPBRMaterial(engine, {
    albedoMap: engine.textureManager.fallbackWhite,
    normalMap: engine.textureManager.fallbackNormal,
    packedMap: engine.textureManager.fallbackWhite,
    packedMapFormat: "ARM",
    
    baseColor: [0.1, 0.5, 0.9, 1.0], // NullGraph Blue
    metallicMultiplier: 0.2,
    roughnessMultiplier: 0.5
});

// Apply the material bindings to the render batch
material.applyToBatch(cubeBatch);`
        },
        {
            heading: "Instance Data & Transformation",
            text: "Even for a single cube, the engine utilizes an ECS-style Float32Array to pass transformation and color data to the GPU. The cube is placed exactly at the origin (0,0,0) with an identity rotation quaternion (W=1.0) and a neutral white color multiplier.",
            code: `const initialData = new Float32Array(STRIDE);

// Position (X, Y, Z)
initialData[1] = 0.0;
initialData[2] = 0.0;
initialData[3] = 0.0; 

// Rotation Quaternion W (Identity)
initialData[7] = 1.0;

// Scale (X, Y, Z)
initialData[8] = 1.0; initialData[9] = 1.0; initialData[10] = 1.0;

// RGB Color Multiplier
initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0;

engine.updateBatchData(cubeBatch, initialData, MAX_INSTANCES);`
        },
        {
            heading: "Dynamic Camera Orbit",
            text: "Because the cube is static, the update loop doesn't need to push new instance data to the GPU every frame. Instead, the demo hooks into the <code>cameraUpdate</code> lifecycle method to slowly orbit the camera around the origin, allowing the PBR lighting to dynamically catch the edges of the geometry over time.",
            code: `cameraUpdate: (cam: Camera, time: number) => {
    // A nice slow orbit around the center (0,0,0) 
    // so we can see the PBR lighting catch the edges
    const radius = 8;
    cam.updateView(
        [Math.sin(time * 0.5) * radius, 3, Math.cos(time * 0.5) * radius],
        [0, 0, 0] // Look at origin
    );
}`
        }
    ]
};