import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const aetherialFlowDocumentation: DemoMetadata = {
    title: "Aetherial Flow",
    concepts: [
        "Compute Shaders",
        "Strange Attractors",
        "Interactive Physics",
        "Post-Processing",
        "Instanced Rendering"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo renders a massive, chaotic swarm of 150,000 particles driven entirely by WebGPU Compute Shaders. Instead of simple gravity, the particles are subjected to a complex vector field combining macro-scale <strong>Lorenz Attractors</strong> and micro-scale fluid noise. It also features interactive mouse gravity and a custom post-processing pipeline for bokeh and bloom."
        },
        {
            heading: "Multi-Force Vector Field",
            text: "The movement of each particle is dictated by a combination of complex forces. A Lorenz strange attractor provides the overarching macro-structure, while a time-based fluid noise function introduces localized turbulence and organic, swirling movement.",
            code: `// 1. MACRO FORCE (Lorenz Attractor)
let sigma = 10.0; let rho = 28.0; let beta = 8.0 / 3.0;
let lp = pos * 0.1; 
let lorenzForce = vec3<f32>(
    sigma * (lp.y - lp.x),
    lp.x * (rho - lp.z) - lp.y,
    lp.x * lp.y - beta * lp.z
);

// 2. MICRO FORCE (Fluid Noise)
let noiseScale = 0.05; let t = time * 0.5;
let p0 = pos * noiseScale + vec3<f32>(t, -t, t*0.5);
let p1 = pos * noiseScale - vec3<f32>(-t, t, -t*0.5);
let fluidForce = vec3<f32>(cos(p0.y) + sin(p1.z), cos(p0.z) + sin(p1.x), cos(p0.x) + sin(p1.y)) * 40.0;`
        },
        {
            heading: "Interactive Mouse Gravity",
            text: "To make the swarm interactive, mouse coordinates are normalized and injected into the compute shader by hijacking unused bytes in the camera's uniform buffer. The particles react to the mouse using an inverse-square law, pulling incredibly hard when close but weakening over distance.",
            code: `// Decode hijacked mouse coordinates
let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
let mouseDir = mouseWorld - pos;
let mouseDist = max(length(mouseDir), 1.0);

// Inverse-square law gravity
let mouseForce = normalize(mouseDir) * (20000.0 / (mouseDist * mouseDist + 50.0));`
        },
        {
            heading: "Dynamic Velocity Alignment",
            text: "In the vertex shader, each particle (a 3D pyramid geometry) is dynamically rotated to face the exact direction it is moving. This is achieved by taking the cross product of the particle's velocity vector and a world 'up' vector to construct a custom rotation matrix on the fly.",
            code: `let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
let worldUp = vec3<f32>(0.0, 1.0, 0.0);

// Failsafe Cross Product: Prevents NaN if moving straight up
var right = cross(worldUp, forward);
if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
right = normalize(right);

let up = cross(forward, right);
let rotMat = mat3x3<f32>(right, up, forward);`
        },
        {
            heading: "Post-Processing & Tonemapping",
            text: "To give the particles a luminous, ethereal quality, the scene is rendered to an offscreen texture and passed through a custom post-processing shader. This pass applies a depth-aware bokeh blur, vignette, and finally an <strong>Uncharted 2 Tonemap</strong> to smoothly compress extreme brightness values into standard dynamic range without color clipping.",
            code: `// Uncharted 2 Tonemap for smooth HDR compression
fn Uncharted2Tonemap(x: vec3<f32>) -> vec3<f32> {
    let A: f32 = 0.15; let B: f32 = 0.50; let C: f32 = 0.10; 
    let D: f32 = 0.20; let E: f32 = 0.02; let F: f32 = 0.30;
    let CB = vec3<f32>(C * B);
    let DE = vec3<f32>(D * E);
    let DF = vec3<f32>(D * F);
    let EF = vec3<f32>(E / F);
    return ((x * (A * x + CB) + DE) / (x * (A * x + vec3<f32>(B)) + DF)) - EF;
}`
        }
    ]
};