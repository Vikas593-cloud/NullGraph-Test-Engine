import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const cymaticDocumentation: DemoMetadata = {
    title: "Cymatic Resonance (Chladni Plate)",
    concepts: [
        "Compute Shaders",
        "Indirect Rendering",
        "Particle Physics",
        "Procedural Generation"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo simulates a <strong>Chladni Plate</strong> experiment. When a metal plate is vibrated with acoustic frequencies, the sand particles are violently thrown into the air, eventually settling into the 'nodes'—the areas of the plate that are completely still. This demo uses WebGPU Compute Shaders to simulate the physics of 100,000 individual grains of sand in real-time."
        },
        {
            heading: "The Chladni Wave Function",
            text: "The geometric patterns are defined by a wave function discovered by Ernst Chladni in 1787. We calculate the vibration intensity at any given point (x, z) on the plate using two opposing wave frequencies (<em>n</em> and <em>m</em>). If the intensity is near zero, it's a node.",
            code: `// The mathematical formula for Chladni patterns
let pi = 3.14159265;
let n = 3.0 + floor(sin(time * 0.2) * 2.0); 
let m = 4.0 + floor(cos(time * 0.15) * 2.0); 

let nx = pos.x / 50.0;
let nz = pos.z / 50.0;

let wave1 = cos(n * pi * nx) * cos(m * pi * nz);
let wave2 = cos(m * pi * nx) * cos(n * pi * nz);
let vibrationIntensity = abs(wave1 - wave2);`
        },
        {
            heading: "Compute Shader Physics",
            text: "In the compute pass, every particle is affected by gravity. When a particle collides with the plate (<code>pos.y <= 0.08</code>), we check the <code>vibrationIntensity</code>. If they hit an antinode (high vibration), they are kicked violently back up. If they hit a node (zero vibration), they lose momentum and settle.",
            code: `// Collision and acoustic kick
if (pos.y <= 0.08) {
    pos.y = 0.08; // Keep on surface
    
    // Kick upwards based on vibration
    vel.y = abs(vel.y) * 0.4 + (vibrationIntensity * 35.0);
    
    // Horizontal scatter
    vel.x += (hash(&prngState) - 0.5) * vibrationIntensity * 10.0;
    vel.z += (hash(&prngState) - 0.5) * vibrationIntensity * 10.0;
}`
        },
        {
            heading: "Indirect Rendering",
            text: "Because the GPU calculates exactly which particles are visible and moving, we use <strong>Indirect Rendering</strong>. The Compute Shader uses an atomic counter to populate a dynamic rendering buffer. The vertex shader then simply reads from this exact same buffer to draw the sand grains, avoiding unnecessary CPU-GPU data transfers.",
            code: `// Compute Shader populating the Draw Args
let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
let wBase = writeIdx * 14u;

// Copy computed state to the render buffer
for(var i = 0u; i < 7u; i = i + 1u) { 
    renderData[wBase + i] = physicsState[base + i]; 
}`
        },
        {
            heading: "Synchronized Plate Shading",
            text: "To make the visual effect complete, the fragment shader for the obsidian plate uses the exact same Chladni math as the compute shader. Instead of applying physics, it uses the <code>vibrationIntensity</code> to mix a glowing neon blue color into the nodes, showing the player exactly where the sand is attempting to settle."
        }
    ]
};