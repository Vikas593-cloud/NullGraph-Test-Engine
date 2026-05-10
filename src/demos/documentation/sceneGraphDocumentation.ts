import { DemoMetadata } from "../../types";

export const sceneGraphDocumentation: DemoMetadata = {
    title: "Hierarchical Scene Graph",
    concepts: [
        "Hierarchical Transforms",
        "OOP Scene Graphs",
        "Multi-Batch Instancing",
        "Tree Traversal",
        "Data Routing"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo implements a classic <strong>Hierarchical Scene Graph</strong> using Object-Oriented Programming (OOP) to simulate a solar system. It calculates complex orbital mechanics (moons orbiting planets, which orbit a sun) on the CPU using a tree structure. The nested, hierarchical data is then dynamically flattened into separate linear arrays to maintain high-performance, instanced GPU rendering."
        },
        {
            heading: "Local vs. World Space Transforms",
            text: "Each <code>SceneNode</code> maintains its own 'local' properties (relative to its parent) and calculates its 'world' properties (absolute position in the scene). During the update loop, the tree is traversed recursively. Each child calculates its final world position by combining its local coordinates with its parent's world scale and position.",
            code: `updateTree(simTime: number, amplitude: number, parentPos: [number, number, number], parentScale: [number, number, number]) {
    // 1. Calculate local movement (orbiting)
    if (this.orbitRadius > 0) {
        const currentAngle = this.initialAngle + (simTime * this.orbitSpeed);
        this.localPos[0] = Math.cos(currentAngle) * this.orbitRadius * amplitude * 0.05;
        this.localPos[2] = Math.sin(currentAngle) * this.orbitRadius * amplitude * 0.05;
    }

    // 2. Inherit parent's transform to calculate final World Position & Scale
    this.worldPos[0] = parentPos[0] + (this.localPos[0] * parentScale[0]);
    this.worldPos[1] = parentPos[1] + (this.localPos[1] * parentScale[1]);
    this.worldPos[2] = parentPos[2] + (this.localPos[2] * parentScale[2]);

    // ... recursively update children
}`
        },
        {
            heading: "Multi-Batch Instancing",
            text: "Because instances in WebGPU must share the same base geometry, we cannot put planets (Cubes) and moons (Quads) into the same render batch. Instead, the engine sets up <strong>two separate render batches</strong>. Both use the exact same pipeline and shader, but are bound to different Vertex/Index Buffers.",
            code: `// Create the Planet Batch (Uses Cube Geometry)
const planetBatch = engine.createBatch(mainPass, pipelineConfig);
engine.setBatchGeometry(planetBatch, cubeVBO, cubeIBO, cubeIndices.length);

// Create the Moon Batch (Uses Quad Geometry)
const moonBatch = engine.createBatch(mainPass, pipelineConfig);
engine.setBatchGeometry(moonBatch, quadVBO, quadIBO, quadIndices.length);`
        },
        {
            heading: "Flattening & Data Routing",
            text: "GPUs cannot easily process tree structures; they require flat, continuous arrays. After the math is calculated, a second recursive pass called <code>flattenInto</code> walks the tree. By inspecting a <code>type</code> tag on each node, it dynamically routes the node's world data into either the planet's Float32Array or the moon's Float32Array.",
            code: `flattenInto(
    planetData: Float32Array, planetCtx: { index: number },
    moonData: Float32Array, moonCtx: { index: number }
) {
    // 1. Decide which array and counter to use based on node type
    const targetData = this.type === 'planet' ? planetData : moonData;
    const targetCtx = this.type === 'planet' ? planetCtx : moonCtx;

    // 2. Write world data into the flat ECS array
    const base = targetCtx.index * 14;
    targetData[base + 1] = this.worldPos[0];
    targetData[base + 2] = this.worldPos[1];
    // ... write scale and color ...
    
    targetCtx.index++; // Increment the pointer for this specific buffer

    // 3. Recurse through children
    for (const child of this.children) {
        child.flattenInto(planetData, planetCtx, moonData, moonCtx);
    }
}`
        }
    ]
};