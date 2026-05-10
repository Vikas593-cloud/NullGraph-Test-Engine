import {DemoMetadata} from "../../types";


export const geometry3DExampleDocumentation: DemoMetadata = {
    title: "Instanced Wave Cubes",
    concepts: [
        "Instanced Rendering",
        "ECS Data Management",
        "Procedural Animation",
        "Vertex Shaders",
        "WebGPU Buffers"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo renders 10,000 3D cubes using efficient WebGPU instanced rendering. The transformation and color data for all cubes are stored in a flat <code>Float32Array</code> acting as an ECS (Entity Component System) structure. The cubes animate dynamically on the CPU using a sine wave function, and the updated data is streamed to the GPU every frame."
        },
        {
            heading: "Geometry & Batching",
            text: "To maximize performance, a single cube geometry is created and uploaded to the GPU once. The engine then sets up a single render batch that draws this geometry up to 10,000 times. The batch specifies a stride of 14 floats to properly map each instance to its corresponding data in the storage buffer.",
            code: `const cubeGeom = Primitives.createCube(PositionOnlyLayout, 1.0, 1.0, 1.0);
cubeGeom.upload(engine);

const cubeBatch = engine.createBatch(mainPass, {
    shaderCode: shaderSource,
    strideFloats: 14,
    maxInstances: MAX_INSTANCES,
    vertexLayouts: cubeGeom.layout.getWebGPUDescriptor()
});

engine.setBatchGeometry(cubeBatch, cubeGeom.vertexBuffer!, cubeGeom.indexBuffer!, cubeGeom.indices.length);`
        },
        {
            heading: "Instanced Vertex Shader",
            text: "The vertex shader uses the built-in <code>instance_index</code> to fetch specific instance data (position, scale, and color) from the uniform storage buffer. It calculates the final world position by applying the individual instance's scale and offset to the local vertex positions.",
            code: `@group(0) @binding(1) var<storage, read> ecs: array<f32>;

@vertex
fn vs_main(
    @location(0) localPos: vec3<f32>,   
    @builtin(instance_index) iIdx: u32
) -> VertexOut {
    let base = iIdx * 14u;
    let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
    let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
    let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

    let worldPos = (localPos * scale) + pos;

    var out: VertexOut;
    out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
    
    // Add some pseudo-lighting based on local position
    out.color = color * (localPos + 0.6); 
    return out;
}`
        },
        {
            heading: "CPU-Side Procedural Animation",
            text: "During the update loop, the application iterates over the flat array, recalculating the Y-position for every instance using a time-based sine wave. This wave is offset by each cube's X-position and scaled by an interactive UI amplitude control. The modified array is then dispatched back to the GPU batch.",
            code: `for (let i = 0; i < MAX_INSTANCES; i++) {
    const base = i * 14;
    const xPos = data[base + 1];
    
    // Calculate new Y position based on time, X position, and UI amplitude
    const waveOffset = Math.sin(simTime * 3.0 + (xPos * 0.1)) * uiState.amplitude;
    data[base + 2] = originalYPositions[i] + waveOffset;
}

// Stream the updated Float32Array to the GPU
engine.updateBatchData(cubeBatch, data, MAX_INSTANCES);`
        }
    ]
};