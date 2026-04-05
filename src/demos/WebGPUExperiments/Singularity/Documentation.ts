import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const singularityDocumentation: DemoMetadata = {
    title: "Singularity",
    concepts: [
        "GPU State Memory",
        "Inverse-Square Gravity",
        "Accretion Disk Swirl",
        "Relativistic Jets",
        "Procedural Motion Blur"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo models the extreme gravitational forces of a black hole using 100,000 particles. Unlike simulations where the CPU updates positions every frame, this demo utilizes <strong>GPU State Memory</strong>. The CPU seeds the initial massive spherical distribution exactly once. From that point forward, the Compute Shader reads from and writes to the exact same storage buffer, giving the particles persistent velocity and spatial memory entirely on the GPU."
        },
        {
            heading: "Compute Physics: Gravity & Accretion",
            text: "The primary driving force is an approximation of Newton's law of universal gravitation, pulling particles toward the origin using an inverse-square law. To prevent division by zero at the singularity, a softening factor is added to the denominator. To form the iconic <strong>Accretion Disk</strong>, a secondary force is applied using the cross product of the particle's inward direction and the $Y$-axis, violently swirling the particles into an orbit.",
            code: `// A. Black Hole Gravity (Inverse-Square Law)
let dir = -pos; 
let dist = max(length(dir), 1.0);
let normDir = dir / dist;
let gravityStrength = 8000.0 / (dist * dist + 50.0);
var force = normDir * gravityStrength;

// B. Accretion Disk Swirl 
// Cross product forces them to orbit the Y axis
let swirlDir = normalize(cross(normDir, vec3<f32>(0.0, 1.0, 0.0)));
force += swirlDir * (gravityStrength * 2.2);`
        },
        {
            heading: "Compute Physics: Relativistic Jets & Noise",
            text: "To give the simulation an organic, cosmic feel, a pseudo-curl noise function generates turbulent fluid dynamics, creating wispy tendrils of matter. If a particle is pulled past the 'event horizon' (a distance less than 12 units), it is subjected to <strong>Relativistic Jets</strong>. The shader calculates whether the particle is slightly above or below the equator using the <code>sign()</code> function and violently ejects it out of the corresponding pole.",
            code: `// C. Pseudo-Curl Noise Turbulence
let nx = sin(pos.y * noiseScale + time) + cos(pos.z * noiseScale);
...
force += vec3<f32>(nx, ny, nz) * 8.0;

// D. Relativistic Jets
// If they get sucked in too close, shoot them out the poles!
if (dist < 12.0) {
    let pole = sign(pos.y + 0.001); // Up (1.0) or Down (-1.0)
    force += vec3<f32>(0.0, pole * 800.0, 0.0);
}`
        },
        {
            heading: "Rendering Technique: Procedural Motion Blur",
            text: "Because particles near the event horizon travel at immense speeds, rendering them as static points breaks the illusion of velocity. The vertex shader implements a highly efficient <strong>Procedural Motion Blur</strong>. By checking if a vertex belongs to the 'front' of the local pyramid geometry (<code>localPos.y > 0.0</code>), it selectively stretches the geometry forward along the velocity vector, turning fast-moving pyramids into long, glowing streaks of light.",
            code: `// MOTION BLUR TRICK: Stretch the geometry along the velocity vector!
let speed = length(vel);
let stretchDir = normalize(vel + vec3<f32>(0.001));

// If localPos.y > 0, pull it forward along the velocity path
let isFrontVertex = step(0.0, localPos.y); 
let motionStretch = stretchDir * (speed * 0.15) * isFrontVertex;

let worldPosition = (localPos * 0.4) + pos + motionStretch;`
        },
        {
            heading: "Post-Processing: Recycled God Rays",
            text: "To maximize efficiency, this scene recycles the <code>godRaysPostProcessShader</code> originally authored for the Quantum Core demo. Because the render shader dynamically maps particle color based on speed (peaking at a bright 'White Hot' for fast particles) and artificially boosts the HDR output (<code>baseColor * 2.5</code>), the post-processing shader naturally catches these intense light values and scatters them into volumetric crepuscular rays."
        }
    ]
};