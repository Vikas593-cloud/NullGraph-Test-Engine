import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const morphogenesisDocumentation: DemoMetadata = {
    title: "Morphogenesis (Alan Turing, 1952)",
    concepts: [
        "Reaction-Diffusion",
        "Gray-Scott Model",
        "In-Place Buffer Mutation",
        "Vertex Displacement",
        "Turing Patterns"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "Inspired by Alan Turing's groundbreaking 1952 paper, <em>The Chemical Basis of Morphogenesis</em>, this demo simulates biological pattern formation (like leopard spots or zebra stripes). It utilizes the <strong>Gray-Scott Reaction-Diffusion</strong> algorithm across a grid of 65,536 cells wrapped seamlessly around a 3D torus, proving that complex, organic labyrinths can emerge from incredibly simple mathematical rules."
        },
        {
            heading: "The Mathematical Foundation: Reaction-Diffusion",
            text: "The simulation tracks two virtual chemicals, A and B. Chemical A is continuously 'fed' into the system, while Chemical B is slowly 'killed' off. The core reaction occurs when two parts of B meet one part of A, consuming A to create more B ($A + 2B \\rightarrow 3B$). By calculating the Laplacian (how much the chemicals are spreading from neighboring cells), the Compute Shader evaluates the differential equations:<br><br>$$ \\frac{\\partial A}{\\partial t} = D_A \\nabla^2 A - AB^2 + f(1-A) $$<br>$$ \\frac{\\partial B}{\\partial t} = D_B \\nabla^2 B + AB^2 - (k+f)B $$",
            code: `// 2. Calculate the Laplacian (Spread)
var lapA = -center_A;
var lapB = -center_B;

// Sample orthogonal and diagonal neighbors (simplified)
lapA += stateGrid[get_idx(gridX - 1, gridY)] * 0.2; 
// ... (adds all 8 neighbors based on distance weights)

// 3. Reaction Equation
let reaction = center_A * center_B * center_B;
let next_A = center_A + (dA * lapA - reaction + feed * (1.0 - center_A)) * dt;
let next_B = center_B + (dB * lapB + reaction - (kill + feed) * center_B) * dt;`
        },
        {
            heading: "Compute Physics: In-Place Mutation",
            text: "Normally, cellular automata require 'Ping-Ponging'—reading from an old buffer and writing to a new buffer to prevent race conditions. However, this demo utilizes a deliberate WebGPU architectural hack: <strong>In-Place Mutation</strong>. By reading and writing to the exact same storage buffer simultaneously, the unpredictable thread execution order of the GPU introduces micro-errors into the math. Instead of crashing, this naturally creates an organic, wind-blown drift, making the labyrinth look truly biological rather than rigidly digital.",
            code: `// 4. Save In-Place (Creates an organic drift effect)
stateGrid[base] = next_A;
stateGrid[base + 1u] = next_B;

// 5. Copy to a stable Render Array for the Vertex Shader
renderGrid[base] = next_A;
renderGrid[base + 1u] = next_B;`
        },
        {
            heading: "Rendering Technique: Data-Driven Displacement",
            text: "To turn a flat texture into a physical, tactile structure, the vertex shader performs <strong>Data-Driven Displacement</strong>. By mapping its UV coordinates to the 256x256 computational grid, the vertex looks up the local chemical concentrations. It subtracts Chemical A from Chemical B, and uses that differential to physically extrude the geometry inward along its normal vector, carving physical valleys into the donut where the chemical reaction takes place.",
            code: `// Read the exact value the compute shader just wrote
let chemA = visualGrid[base];
let chemB = visualGrid[base + 1u];
let value = chemB - chemA; 

// Extrude geometry inwards where chemical B has eaten chemical A
let displacement = localNormal * (value * -3.5);
let worldPosition = localPos + displacement;

// Color mapping: Deep Void Purple to Bio-Luminescent Green
out.color = mix(
    vec3<f32>(0.1, 0.0, 0.2), 
    vec3<f32>(0.2, 1.0, 0.5), 
    smoothstep(-0.2, 0.2, value)
);`
        },
        {
            heading: "Initialization: The Spores",
            text: "Reaction-Diffusion systems require a catalyst. If the torus was filled purely with Chemical A, nothing would happen. During the CPU initialization phase, alongside a massive cluster in the dead center, the grid is seeded with random, microscopic 'spores' of Chemical B (given a 0.5% chance to spawn). This guarantees the reaction quickly catches fire across the entire surface of the massive grid."
        }
    ]
};