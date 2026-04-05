import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const stellaratorFluxDocumentation: DemoMetadata = {
    title: "Stellarator Flux",
    concepts: [
        "Magnetic Confinement",
        "Poloidal & Toroidal Fields",
        "Plasma Pinch Instability",
        "Thermal Color Mapping",
        "Velocity Stretching"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo simulates the extreme physics of a nuclear fusion reactor (specifically a Tokamak or Stellarator). It confines 150,000 superheated plasma particles within an invisible magnetic torus. By combining distinct magnetic field vectors and simulating macro-scale instabilities, the compute shader creates a swirling, breathing ring of high-energy plasma that reacts violently when the containment field is breached by the user's cursor."
        },
        {
            heading: "Compute Physics: The Magnetic Containment Ring",
            text: "The core of the simulation relies on finding the nearest point on a mathematical ring (the major radius) and pulling the particles toward a defined distance from it (the minor radius). To make the plasma feel organic and violently energetic, the shader introduces a <strong>Plasma Pinch Instability</strong>. By calculating the toroidal angle of the particle and passing it through a sine wave, the minor radius dynamically expands and contracts over time, causing the tube to 'breathe' unevenly.",
            code: `// 1. Find the nearest point on the central Torus ring
let posXZ = vec2<f32>(pos.x, pos.z);
let dirXZ = normalize(posXZ);
let ringPos = vec3<f32>(dirXZ.x * majorRadius, 0.0, dirXZ.y * majorRadius);

// 2. Plasma Pinch Instability (Breathing effect along the ring)
let toroidalAngle = atan2(pos.z, pos.x);
let pinch = sin(toroidalAngle * 8.0 - time * 4.0) * 8.0;
let dynamicMinorRadius = baseMinorRadius + pinch;

// 3. Confinement Force (Pulls plasma into the tube shape)
let confinementForce = -normToParticle * (distToRing - dynamicMinorRadius) * 15.0;`
        },
        {
            heading: "Compute Physics: Poloidal and Toroidal Fields",
            text: "Real fusion reactors require complex, twisting magnetic fields to keep plasma from escaping. This simulation applies two distinct directional forces to mimic this geometry. The <strong>Toroidal Field</strong> propels particles in a continuous circle along the main ring. The <strong>Poloidal Field</strong> forces the particles to spiral around the cross-section of the tube. Together, they create the iconic twisted corkscrew flow of a stellarator.",
            code: `// B: Poloidal Field (Spiraling around the cross-section)
let tangentXZ = vec3<f32>(dirXZ.x, 0.0, dirXZ.y);
let poloidalDir = cross(normToParticle, tangentXZ);
let poloidalForce = poloidalDir * 65.0;

// C: Toroidal Field (Spinning around the main Y axis)
let toroidalDir = vec3<f32>(-dirXZ.y, 0.0, dirXZ.x);
let toroidalForce = toroidalDir * 120.0;`
        },
        {
            heading: "Thermal Color Mapping",
            text: "Instead of coloring particles purely based on their velocity, the compute shader utilizes a <strong>Thermal Map</strong> based on spatial proximity to the magnetic core. The closer a particle is to the absolute center of the minor radius, the hotter it gets, transitioning from deep purple at the edges to a searing white-pink at the core. A secondary velocity check is overlaid, causing particles that are moving exceptionally fast to spark bright orange.",
            code: `// Map color based on proximity to the magnetic core
let heat = clamp(1.0 - (distToRing / (dynamicMinorRadius * 1.5)), 0.0, 1.0);

let edgeColor = vec3<f32>(0.5, 0.0, 1.0);  // Deep Purple
let midColor  = vec3<f32>(0.0, 0.8, 1.0);  // Neon Cyan
let coreColor = vec3<f32>(1.0, 0.9, 1.0);  // Superhot White-Pink

var finalColor = mix(edgeColor, midColor, smoothstep(0.1, 0.6, heat));
finalColor = mix(finalColor, coreColor, smoothstep(0.6, 1.0, heat));

// Velocity sparks (fast particles flash orange/gold)
finalColor += vec3<f32>(1.0, 0.4, 0.0) * smoothstep(150.0, 220.0, speed);`
        },
        {
            heading: "Rendering: Velocity Stretching & Optics",
            text: "To convey the extreme speeds of the plasma, the vertex shader dynamically scales the base geometry along its local Z-axis based on the particle's velocity vector, turning standard pyramids into sharp streaks of light. The colors are intentionally over-driven (multiplied by 2.5) before being passed to the recycled <strong>Bokeh & Bloom</strong> post-processing shader, where the Uncharted 2 Tonemapper smoothly compresses the HDR plasma cores into a cinematic visual."
        }
    ]
};