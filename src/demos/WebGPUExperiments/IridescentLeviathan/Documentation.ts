import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const iridescentLeviathanDocumentation: DemoMetadata = {
    title: "Iridescent Leviathan",
    concepts: [
        "Fluid Dynamics (Curl Noise)",
        "Screen-Space Refraction",
        "Thin-Film Iridescence",
        "Procedural Billboarding",
        "Deferred Normal Mapping"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo simulates a massive school of 150,000 microscopic glass beads caught in a turbulent fluid current. To achieve the complex optical effects—refraction, soap-bubble iridescence, and sharp specular highlights—without melting the GPU, it employs a <strong>Deferred Rendering</strong> strategy. The geometry pass calculates perfect sphere normals and saves them to a texture, while a post-processing pass handles the heavy optical physics against a procedural neon grid."
        },
        {
            heading: "Compute Physics: Incompressible Flow & Vortices",
            text: "To simulate fluid dynamics without the immense cost of particle-to-particle collision detection, the compute shader generates an incompressible vector field using <strong>Curl Noise</strong>. By deriving pseudo-pressure gradients across the $X$, $Y$, and $Z$ axes using phase-shifted sine and cosine waves, the particles naturally swirl into non-intersecting currents. Additionally, mouse interaction doesn't just pull particles; it creates a mathematical vortex by taking the cross product of the vector pointing to the mouse and the world's up-vector.",
            code: `// Compute pseudo-pressure gradients for incompressible flow
let cx = sin(pos.y * scale1 + time) + cos(pos.z * scale2 - time);
let cy = sin(pos.z * scale1 + time) + cos(pos.x * scale2 + time);
let cz = sin(pos.x * scale1 - time) + cos(pos.y * scale2 + time);

let fluidForce = vec3<f32>(cx, cy, cz) * 25.0;

// Mouse Vortex Interaction
let vortex = cross(normalize(dirToMouse), vec3<f32>(0.0, 1.0, 0.0));
mouseForce = vortex * (60.0 - distToMouse) * 1.5;`
        },
        {
            heading: "Rendering: Procedural Sphere Imposters",
            text: "Rendering 150,000 high-poly 3D spheres would bottleneck the vertex pipeline. Instead, the vertex shader passes raw, flat geometry billboarded to perfectly face the camera. The fragment shader then mathematically constructs a perfect 3D sphere on that flat surface. It calculates the radial distance from the center, discards any pixels outside a radius of 1.0 to form a circle, and calculates the true spherical $Z$-depth using the Pythagorean theorem: $Z = \\sqrt{1 - (X^2 + Y^2)}$.",
            code: `// Fragment Shader: Procedural Sphere Generation
let distSq = dot(uv, uv);

// Discard pixels outside the radius to make perfect circles
if (distSq > 1.0) { discard; }

// Calculate the Z-height of a perfect sphere mathematically
let z = sqrt(1.0 - distSq);
let normal = vec3<f32>(uv.x, uv.y, z);

// Encode normal from [-1, 1] to [0, 1] for the deferred texture
let encodedNormal = normal * 0.5 + vec3<f32>(0.5);`
        },
        {
            heading: "Optics: Screen-Space Refraction",
            text: "The magic happens in the post-processing pass. By reading the encoded normal map and the alpha mask, the shader knows exactly where the spheres are and which way their surfaces are facing. To simulate <strong>Refraction</strong> (glass bending light), it offsets the screen's UV coordinates based on the $X$ and $Y$ tilt of the sphere's normal before sampling the procedural neon background.",
            code: `// Decode normal back to [-1, 1]
let normal = normalize(samp.rgb * 2.0 - vec3<f32>(1.0));

// GLASS REFRACTION
// Bend the UV coordinates behind the sphere based on its normal
let refractionStrength = 0.08;
let refractedUV = uv - normal.xy * refractionStrength;
let bgBehindGlass = getBackground(refractedUV, time);`
        },
        {
            heading: "Optics: Thin-Film Iridescence & Fresnel",
            text: "To give the glass spheres the look of soap bubbles, the shader simulates <strong>Thin-Film Interference</strong>. The perceived color shifts based on the angle of view (the dot product of the Normal and the View Direction) and a slowly pulsing film thickness. This phase value is fed into a mathematical cosine palette to generate iridescent bands of color. Finally, an aggressive <strong>Fresnel</strong> curve dictates that the edges of the spheres reflect more light than the centers, giving them physical volume.",
            code: `let viewDir = vec3<f32>(0.0, 0.0, 1.0);
let NdotV = max(dot(normal, viewDir), 0.0);

// Thin-Film Iridescence
let filmThickness = 300.0 + sin(time * 0.5) * 150.0; 
let phase = filmThickness * NdotV * 0.01;
let iridescence = palette(phase);

// Fresnel & Specular Highlight
let fresnel = pow(1.0 - NdotV, 3.0);
let specular = pow(NdotV, 90.0) * 1.5;

// Composite optical layers
var finalColor = mix(bgBehindGlass, iridescence, fresnel * 0.8) + vec3<f32>(specular);`
        }
    ]
};