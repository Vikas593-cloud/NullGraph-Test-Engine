import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const etherealGyroidDocumentation: DemoMetadata = {
    title: "Ethereal Gyroid",
    concepts: [
        "Triply Periodic Minimal Surfaces",
        "Gradient Calculation",
        "Tangential Vector Fields",
        "Cosine Palettes",
        "Chromatic Aberration"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo reveals invisible mathematical structures by constraining a swarm of 150,000 particles to the surface of a <strong>Triply Periodic Minimal Surface (TPMS)</strong>. As time progresses, the compute shader dynamically morphs the topology between a Gyroid and a Schwarz P surface. The particles are driven by tangential vector fields, forcing them to flow like magnetic fluid through an infinite labyrinth."
        },
        {
            heading: "The Mathematical Foundation: TPMS",
            text: "Triply Periodic Minimal Surfaces are structures that extend infinitely in all three dimensions without self-intersecting, naturally minimizing their surface area. The compute shader calculates the signed distance to two different TPMS topologies and linearly interpolates between them:<br><br><strong>The Gyroid:</strong><br>$$ \\sin(x)\\cos(y) + \\sin(y)\\cos(z) + \\sin(z)\\cos(x) = 0 $$<br><br><strong>The Schwarz P Surface:</strong><br>$$ \\cos(x) + \\cos(y) + \\cos(z) = 0 $$",
            code: `// Equation 1: The Gyroid
let gyroid = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);

// Equation 2: The Schwarz P Surface
let schwarz = cos(p.x) + cos(p.y) + cos(p.z);

// Morph between them smoothly over time
let morph = sin(time * 0.5) * 0.5 + 0.5;
let surfaceDist = mix(gyroid, schwarz, morph);`
        },
        {
            heading: "Compute Physics: Adhesion and Flow",
            text: "To make the particles traverse the surface, we first need to find the surface normal. Because the surface is morphing, we calculate the gradient dynamically using the <strong>finite difference method</strong>. Once we have the normal, we apply two forces: an <em>adhesion force</em> that pulls the particle directly against the surface, and a <em>tangential force</em> (calculated via the cross product of the normal and a directional vector) that forces the particle to slide along the contours of the geometry.",
            code: `// 1. Surface Adhesion: Pull particles strongly toward the surface
let adhesionForce = -normal * surfaceDist * 250.0;

// 2. Tangential Flow: Make them slide ALONG the surface using a cross product
let flowAxis = normalize(vec3<f32>(sin(time), cos(time*0.8), sin(time*1.2)));
var tangentForce = cross(normal, flowAxis) * 120.0;

// Combine forces
var force = adhesionForce + tangentForce;`
        },
        {
            heading: "Procedural Iridescence: Cosine Palettes",
            text: "To give the swarm a pearlescent, beetle-wing aesthetic, the color is generated entirely via math rather than textures. We use a <strong>Cosine Palette</strong> (a technique popularized by Inigo Quilez) driven by the dot product of the surface normal. As the surface twists and the normal direction changes relative to the light/camera, the inputs to the cosine function shift, smoothly cycling through a mathematically continuous spectrum of colors.",
            code: `// Helper: Palette generator for iridescent colors
fn cosPalette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
    return a + b * cos(6.28318 * (c * t + d));
}

// Map the surface normal to the palette parameter
let paletteT = dot(normal, vec3<f32>(0.577)) * 0.5 + 0.5 + morph;
var color = cosPalette(
    paletteT, 
    vec3<f32>(0.5, 0.5, 0.5), 
    vec3<f32>(0.5, 0.5, 0.5), 
    vec3<f32>(2.0, 1.0, 0.0), 
    vec3<f32>(0.5, 0.20, 0.25)
);`
        },
        {
            heading: "Rendering: Velocity Stretching & Chromatic Aberration",
            text: "In the vertex shader, the particle geometry is dynamically scaled along its $Z$ axis based on its velocity magnitude, stretching fast-moving particles into glowing strings or sparks. Finally, the scene is passed through a custom post-processing shader that applies a radial <strong>Chromatic Aberration</strong>—splitting the red, green, and blue color channels based on their distance from the center of the screen to simulate the optical distortion of a physical camera lens.",
            code: `// Vertex Shader: Scale based on speed
let speed = clamp(length(vel), 1.0, 50.0);
let scaleVec = vec3<f32>(0.15, 0.15, 0.3 + speed * 0.1); 
let orientedPos = rotMat * (localPos * scaleVec);

...

// Post-Process: Chromatic Aberration
let aberrationAmount = pow(distFromCenter, 2.0) * 0.03;
let dir = normalize(uv - center);

let r = textureSample(screenTex, screenSamp, uv - dir * aberrationAmount).r;
let g = textureSample(screenTex, screenSamp, uv).g;
let b = textureSample(screenTex, screenSamp, uv + dir * aberrationAmount).b;`
        }
    ]
};