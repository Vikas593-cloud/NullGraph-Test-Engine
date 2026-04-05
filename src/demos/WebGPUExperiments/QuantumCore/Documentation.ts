import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const quantumCoreDocumentation: DemoMetadata = {
    title: "Quantum Core",
    concepts: [
        "Torus Knots",
        "CPU Orbital Physics",
        "HDR Rendering",
        "Volumetric Light Scattering",
        "ACES Tonemapping"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo visualizes a hyper-dense cybernetic structure composed of 25,000 'tech-shards'. Unlike pure compute shader demos, this utilizes <strong>CPU Orbital Physics</strong> to mathematically constrain particles to intricate, interlocking geometric pathways. The scene leverages true High Dynamic Range (HDR) rendering, pushing color values well beyond 1.0, which are then optically scattered and tonemapped in a cinematic post-processing pipeline."
        },
        {
            heading: "The Mathematical Foundation: Torus Knots",
            text: "The underlying structure of the core is built upon <strong>Torus Knots</strong>. In knot theory, a torus knot is defined by a pair of coprime integers, $p$ and $q$, where the knot wraps around the axis of rotational symmetry $p$ times and around a circle in the interior of the torus $q$ times. By assigning different $p$ and $q$ pairs to different layers of particles, we create nested, non-intersecting rings of motion. The CPU updates the parametric angle $\\theta$ every frame to drive the orbit.",
            code: `// The parametric equations for a Torus Knot
const r = Math.cos(state.knotQ * state.theta) + state.radius;
const x = r * Math.cos(state.knotP * state.theta);
const y = Math.sin(state.knotQ * state.theta) * (state.radius * 0.5);
const z = r * Math.sin(state.knotP * state.theta);`
        },
        {
            heading: "Physics Simulation: CPU Updates & Turbulence",
            text: "While Compute Shaders are powerful for massive independent particle systems, mathematically rigorous systemic paths can sometimes be efficiently handled on the CPU if the instance count is kept reasonable (25,000). The CPU calculates the exact knot position, injects localized sine-wave turbulence, and factors in the user's mouse position as a 'gravity disruptor'. The entire floating-point buffer is then written to the GPU every frame.",
            code: `// Add turbulence, but let the mouse X position act as a "gravity disruptor"
const turbulence = Math.sin(simTime * 2.0 + i) * (0.5 + Math.abs(mouseX) * 2.0);

data[base + 1] = x + turbulence;
data[base + 2] = y + turbulence;
data[base + 3] = z + turbulence;`
        },
        {
            heading: "Rendering: Geometry Tumble & HDR Heat",
            text: "To make the simple cube geometry look like complex, tumbling debris, the vertex shader derives an arbitrary rotation axis from the instance ID and applies a localized rotation matrix. Furthermore, it measures the particle's distance from the origin ($0, 0, 0$). As particles approach the dense center, they receive a massive <strong>HDR Glow Multiplier</strong>, driving their RGB values as high as 5.0, creating an artificially hot core.",
            code: `// Give each particle a slight local rotation based on its ID
let tumbleAxis = normalize(vec3<f32>(f32(iIdx % 3u), f32(iIdx % 5u), 1.0));
let rotatedLocal = rotate_axis(localPos * scale, tumbleAxis, ecs[base + 1u] * 0.1); 

// Boost color intensity based on how close it is to the center
let distFromCenter = length(pos);
let coreHeat = smoothstep(15.0, 0.0, distFromCenter) * 5.0; // HDR Glow multiplier

out.color = baseColor * (1.0 + coreHeat);`
        },
        {
            heading: "Post-Processing: God Rays & ACES",
            text: "Because the core particles output HDR values, the post-processing shader must handle the excess light. It first applies <strong>Volumetric Light Scattering (God Rays)</strong> by taking 50 radial samples out from the center of the screen, decaying the weight of the accumulated bright pixels to simulate light bleeding through a dusty atmosphere. Finally, it uses the industry-standard <strong>ACES Filmic Tonemap</strong> curve to elegantly compress the blown-out values back down into the standard 0.0 to 1.0 display range, maintaining rich color saturation.",
            code: `// ACES Filmic Tone Mapping Curve
fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51; let b = vec3<f32>(0.03); 
    let c = 2.43; let d = vec3<f32>(0.59); 
    let e = vec3<f32>(0.14);
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Apply ACES Tonemapping (Tames the HDR blowouts into rich colors)
finalColor = ACESFilm(finalColor * 1.2); // 1.2 Exposure`
        }
    ]
};