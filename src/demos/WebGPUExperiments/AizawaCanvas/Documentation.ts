import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const aizawaCanvasDocumentation: DemoMetadata = {
    title: "Aizawa Canvas",
    concepts: [
        "Aizawa Attractor",
        "Kuwahara Filtering",
        "Billboarding",
        "Compute Integration",
        "Viscosity Fields"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo fuses chaos theory with non-photorealistic rendering (NPR). It computes the paths of 150,000 particles trapped within an <strong>Aizawa Attractor</strong>—a mathematical topology that creates a distinct, apple-like spherical structure with a tubular core. To achieve the aesthetic of wet acrylic paint, the particles are rendered as flat billboards and processed through a Kuwahara filter."
        },
        {
            heading: "The Mathematical Foundation: Aizawa Attractor",
            text: "The particle trajectories are governed by a system of non-linear differential equations defining the Aizawa Attractor, a classic model studied in continuous-time dynamical systems. The compute shader calculates the instantaneous velocity vectors for each particle using the following set of equations:<br><br>$$dx = (z - b)x - dy$$<br>$$dy = dx + (z - b)y$$<br>$$dz = c + az - \\frac{z^3}{3} - (x^2 + y^2)(1 + ez) + fzx^3$$<br><br>By scaling the coordinates down, we numerically integrate these equations using the Euler method (with <code>dt = 0.016</code>) to trace the continuous flow of the vector field, and then scale the resulting force back up to fit our 3D world space.",
            code: `// Scale down position to keep the math stable
let p = pos * 0.3; 

let dx = (p.z - b) * p.x - d * p.y;
let dy = d * p.x + (p.z - b) * p.y;
let dz = c + a * p.z - (p.z * p.z * p.z)/3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * p.x * p.x * p.x;

// Scale force back up for WebGPU coordinate space
var force = vec3<f32>(dx, dy, dz) * 12.0;`
        },
        {
            heading: "Compute Techniques: Noise and Viscosity",
            text: "To prevent the particles from collapsing into infinitely thin, perfect mathematical lines, the compute shader injects a deterministic pseudo-random noise function (<code>hash3</code>) into the force vector. This gives the resulting ribbons organic 'thickness'. Additionally, the mouse interaction doesn't act as gravity; instead, it acts as a localized <strong>Viscosity Field</strong>, drastically increasing the friction multiplier when particles pass near the cursor, simulating thick sludge.",
            code: `// MOUSE VISCOSITY FIELD
let mouseWorld = vec3<f32>(camera.eye.x * 50.0, camera.eye.y * 50.0, 10.0);
let distToMouse = length(pos - mouseWorld);

// If close to the mouse, massively increase friction (viscosity)
var friction = 0.96; 
if (distToMouse < 25.0) {
    friction = 0.70; // Thick sludge
}`
        },
        {
            heading: "Rendering Technique: Billboarding",
            text: "Instead of mathematically rotating 3D geometry to align with a velocity vector, the vertex shader uses <strong>Billboarding</strong>. It extracts the camera's <code>right</code> and <code>up</code> vectors directly from the view-projection matrix to force the particle geometry to perfectly face the camera at all times. This creates dense, flat circles of color, which serves as the optimal high-contrast input for the painterly post-processing step.",
            code: `// Extract camera right and up vectors from viewProj
let right = vec3<f32>(camera.viewProj[0][0], camera.viewProj[1][0], camera.viewProj[2][0]);
let up = vec3<f32>(camera.viewProj[0][1], camera.viewProj[1][1], camera.viewProj[2][1]);

// Force geometry to face the camera
let worldPosition = pos + right * localPos.x * scale + up * localPos.y * scale;`
        },
        {
            heading: "Post-Processing: The Kuwahara Filter",
            text: "The 'wet paint' aesthetic is achieved using a <strong>Kuwahara Filter</strong>, a non-linear smoothing filter originally developed for medical imaging but heavily utilized in NPR stylization. The fragment shader evaluates a radius around a pixel, dividing it into four quadrants. It calculates the mean color and variance (using $ \\sigma^2 $) of each quadrant, and assigns the target pixel the mean color of the quadrant with the <em>lowest</em> variance. This effectively flattens internal textures into solid brush strokes while perfectly preserving sharp outer edges. A subtle chromatic aberration is applied to the fringes of the strokes to mimic a glossy clear-coat."
        }
    ]
};