import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const gyroidResonanceDocumentation: DemoMetadata = {
    title: "Gyroid Resonance",
    concepts: [
        "Dynamic TPMS",
        "Analytical Gradients",
        "Volumetric Light Scattering",
        "Photographic Halation",
        "ACES Tonemapping"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo orchestrates 150,000 particles trapped within a continuously shifting <strong>Gyroid Lattice</strong>. Unlike standard static structures, the mathematical phase of the lattice is driven by time, causing the geometry to endlessly fold inside out. To elevate the visual fidelity, the scene utilizes an advanced post-processing pipeline featuring volumetric god rays, photographic red halation, and industry-standard ACES filmic tonemapping."
        },
        {
            heading: "The Mathematical Foundation: Analytical Gradients",
            text: "Instead of estimating the surface normal using finite differences, this compute shader calculates the exact analytical gradient (the partial derivatives) of the Gyroid function. The base function is:<br><br>$$f(x,y,z) = \\sin(x)\\cos(y) + \\sin(y)\\cos(z) + \\sin(z)\\cos(x)$$<br><br>By applying the chain rule, we extract the precise directional vectors ($dx, dy, dz$) that push the particles into the valleys of the structure. By shifting the phase of $x, y, z$ asymmetrically over time, the entire lattice acts like an organic, folding muscle.",
            code: `// Analytical Gradient of the Gyroid
// Shifting phase with 'time' makes the lattice continuously fold inside out
let t1 = p.x + time; 
let t2 = p.y - time*0.5; 
let t3 = p.z + time*0.8;

let dx = cos(t1)*cos(t2) - sin(t3)*sin(t1);
let dy = cos(t2)*cos(t3) - sin(t1)*sin(t2);
let dz = cos(t3)*cos(t1) - sin(t2)*sin(t3);

// Push particles into the structural valleys
let gyroidForce = vec3<f32>(dx, dy, dz) * 60.0;`
        },
        {
            heading: "Compute Physics: Fracture Shockwaves",
            text: "While the particles naturally settle into the gyroid and swirl via applied curl noise, the user's mouse acts as a violent disruptor. Rather than pulling particles, the mouse coordinate triggers an extreme, localized anti-gravity explosion. It uses an inverse-square law to shatter the lattice locally, which then rapidly heals as the particles are re-captured by the gyroid's mathematical pull.",
            code: `// THE MOUSE "FRACTURE" SHOCKWAVE
let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
let mouseDir = pos - mouseWorld; 
let mouseDistSq = dot(mouseDir, mouseDir);

// Extremely localized, extremely violent anti-gravity explosion
let fractureForce = normalize(mouseDir) * (500000.0 / (mouseDistSq + 100.0));`
        },
        {
            heading: "Post-Processing: Volumetric God Rays",
            text: "To simulate light scattering through a dense atmosphere, the fragment shader employs a radial blur technique originating from the screen's center. Over 25 distinct samples, it isolates the brightest pixels, scales them outward, and decays their intensity. This creates the optical illusion of <strong>God Rays</strong> (crepuscular rays) bleeding from the glowing center of the swarm.",
            code: `// Extract only the brightest parts for the rays
samp *= smoothstep(0.5, 1.5, length(samp)); 

// Accumulate and decay
godRays += samp * illuminationDecay * weight;
illuminationDecay *= decay;`
        },
        {
            heading: "Post-Processing: Halation & ACES Tonemapping",
            text: "To achieve a truly cinematic look, the shader replicates two physical film phenomena. First, <strong>Photographic Halation</strong>: it checks surrounding pixels for extreme luminance ($> 0.8$) and forces them to bleed a red/orange tint into neighboring pixels, mimicking how bright light bounces off the back of physical film stock. Finally, the accumulated scene color is compressed using the <strong>ACES Filmic Tonemap</strong> curve, which beautifully rolls off over-exposed highlights without destroying color saturation.",
            code: `// ACES Filmic Tonemapping curve (Industry standard for HDR rendering)
fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Apply Tonemapping (Boosting exposure into the curve)
finalColor = ACESFilm(finalColor * 1.5);`
        }
    ]
};