import { DemoMetadata } from "../../../types";

export const epicSwarmDocumentation: DemoMetadata = {
    title: "Epic Cosmic Swarm & Compute Physics",
    concepts: [
        "Compute Shaders",
        "Indirect Drawing",
        "WebGPU Atomics",
        "Velocity Alignment",
        "Orthonormal Basis Matrices"
    ],
    sections: [
        {
            heading: "Overview: GPU-Driven Simulation",
            isOpen: true,
            text: "In a standard rendering pipeline, the CPU calculates the position of every object and sends that data to the GPU each frame. For 8,000 complex 3D meshes, this creates a massive bottleneck. <strong>GPU-Driven Rendering</strong> solves this. In this demo, the CPU only seeds the initial positions once. After that, a <em>Compute Shader</em> takes complete control, calculating physics, gravity, and turbulence, and passing that data directly to the Render Pipeline without the CPU ever getting involved."
        },
        {
            heading: "1. The Compute Physics Engine",
            text: "The compute shader acts as our physics engine. Every frame, it reads the current position and velocity of each instance. It applies a central gravity well, a tangential swirl force to create an accretion disk, and a 3D noise function for organic turbulence. Finally, it integrates these forces into the new velocity and position.",
            code: `// Simulating Gravity, Swirl, and Turbulence
let dir = -pos; 
let dist = max(length(dir), 1.0);
let normDir = dir / dist;

// A. Central Gravity
let gravityStrength = 12000.0 / (dist * dist + 150.0);
var force = normDir * gravityStrength;

// B. Orbital Swirl (Cross Product)
var swirl = cross(normDir, vec3<f32>(0.0, 1.0, 0.0));
force += normalize(swirl) * (gravityStrength * 2.5);

// C. Organic Turbulence
let noiseScale = 0.05;
force += vec3<f32>(
    sin(pos.y * noiseScale + time) + cos(pos.z * noiseScale),
    sin(pos.z * noiseScale + time) + cos(pos.x * noiseScale),
    sin(pos.x * noiseScale + time) + cos(pos.y * noiseScale)
) * 12.0;`
        },
        {
            heading: "2. WebGPU Atomics & Indirect Drawing",
            text: "Because the GPU is handling the physics, the CPU doesn't actually know how many valid instances exist to draw (e.g., if we destroy instances that fall into the center). We use an <strong>Indirect Draw Buffer</strong> and <strong>WebGPU Atomics</strong>. The compute shader safely counts up valid particles and packs them tightly into a render buffer, telling the render pipeline exactly how many meshes to draw.",
            code: `// Atomic Draw Packing in the Compute Shader
// Atomically increment the instance count to avoid race conditions
let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
let wBase = writeIdx * 14u;

// Pack the calculated physics state into the Render Buffer
for(var i = 0u; i < 14u; i = i + 1u) {
    renderData[wBase + i] = physicsState[base + i];
}

// Inject the dynamic Nebula color
renderData[wBase + 11u] = finalColor.r; 
renderData[wBase + 12u] = finalColor.g; 
renderData[wBase + 13u] = finalColor.b;`
        },
        {
            heading: "3. Velocity Alignment (LookAt Matrix)",
            text: "To make the 3D meshes look like a living swarm rather than static particles, they need to face the direction they are flying. In the Vertex Shader, we read the velocity vector from the compute pass and construct an <strong>Orthonormal Basis</strong> (a rotation matrix) on the fly. This physically banks and turns every single mesh into the flow of the turbulence.",
            code: `// Constructing a LookAt Rotation Matrix from Velocity
let forward = normalize(vel + vec3<f32>(0.001, 0.0, 0.0));
let worldUp = vec3<f32>(0.0, 1.0, 0.0);

// Calculate Right and Up vectors
var right = cross(worldUp, forward);
if (length(right) < 0.01) { right = vec3<f32>(1.0, 0.0, 0.0); }
right = normalize(right);
let up = cross(forward, right);

// Build the 3x3 Rotation Matrix
let rotMat = mat3x3<f32>(right, up, forward);

// Apply rotation to the raw GLB vertex and normal
let rotatedPos = rotMat * (localPos * scale);
let rotatedNorm = normalize(rotMat * normal);`
        },
        {
            heading: "4. HDR Emissive Boost",
            text: "To trigger the photographic God Rays and Halation in the post-processing pass, our render shader must output values far beyond standard white (1.0). We calculate simple directional lighting using the rotated normals, apply the dynamic heat color, and multiply the final output by a massive HDR scaler.",
            code: `// Forward Lighting and HDR Boost
let lightDir = normalize(-worldPosition); 
let diffuse = max(dot(rotatedNorm, lightDir), 0.0);

let ambient = 0.4;
let lighting = ambient + (diffuse * 0.8);

// Multiply by 3.5 to push values out of LDR range and into HDR,
// causing the ACES tonemapper and Volumetric pass to bloom.
out.color = heatColor * lighting * 3.5; `
        }
    ]
};