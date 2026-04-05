import { DemoMetadata } from "../../../types"; // Adjust the import path to match your structure

export const hopfFibrationDocumentation: DemoMetadata = {
    title: "Hopf Fibration",
    concepts: [
        "4D Topology",
        "Stereographic Projection",
        "Clifford Translations",
        "Anamorphic Flares",
        "Parametric Flow"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "This demo visualizes the <strong>Hopf Fibration</strong>, a foundational concept in algebraic topology discovered by Heinz Hopf in 1931. It demonstrates how a 4-dimensional sphere ($S^3$) can be continuously mapped into a 3-dimensional sphere ($S^2$) such that every distinct point in 3D space corresponds to a distinct, non-intersecting circular loop (a 'fiber') in 4D space. The compute shader calculates the paths of 150,000 particles locked to these 4D fibers and mathematically projects them down into our 3D viewport."
        },
        {
            heading: "The Mathematical Foundation: Parametric 4D Mapping",
            text: "Instead of simulating forces like gravity, the particles are strictly bound to parametric equations defining the hypersphere. Each particle is initialized with three angles: <code>eta</code> ($0$ to $\\frac{\\pi}{2}$) determines which specific nested torus the particle belongs to, while <code>xi1</code> and <code>xi2</code> ($0$ to $2\\pi$) determine the particle's exact location along the circular fiber of that torus. By steadily incrementing <code>xi1</code> and <code>xi2</code> over time, the particles 'flow' along the fibers.",
            code: `// Increment parametric angles to move along the 4D fiber
let speed = 0.5;
xi1 += 0.016 * speed * 2.0;
xi2 += 0.016 * speed * 1.5;

// Map parametric angles to a 4D hypersphere (x, y, z, w)
var p4 = vec4<f32>(
    sin(eta) * cos(xi1),
    sin(eta) * sin(xi1),
    cos(eta) * cos(xi2),
    cos(eta) * sin(xi2)
);`
        },
        {
            heading: "Compute Mathematics: Rotation & Stereographic Projection",
            text: "Before visualizing the structure, we can rotate it. Because it is 4D, the rotation occurs across multiple planes simultaneously (a <strong>Clifford Translation</strong>), controlled by the user's mouse. Finally, to render a 4-dimensional object on a 2D screen representing 3D space, we must project it. We use <strong>Stereographic Projection</strong>, which divides the $X$, $Y$, and $Z$ coordinates by a function of the $W$ coordinate, mathematically 'unrolling' the hypersphere into 3D space.",
            code: `// 4D ROTATION (Clifford Translation via Mouse)
// We rotate the XW plane and the YZ plane simultaneously
let c1 = cos(rotAngle1); let s1 = sin(rotAngle1);
let c2 = cos(rotAngle2); let s2 = sin(rotAngle2);

let x_new = p4.x * c1 - p4.w * s1;
let w_new = p4.x * s1 + p4.w * c1;
let y_new = p4.y * c2 - p4.z * s2;
let z_new = p4.y * s2 + p4.z * c2;
p4 = vec4<f32>(x_new, y_new, z_new, w_new);

// STEREOGRAPHIC PROJECTION TO 3D
// (1.2 - p4.w) prevents division by zero when w approaches 1
let scale = 18.0 / (1.2 - p4.w); 
let pos3D = vec3<f32>(p4.x, p4.y, p4.z) * scale;`
        },
        {
            heading: "Rendering Technique: Delta Stretching",
            text: "Because the particles are directly teleported along mathematical functions rather than accelerated by physics, they do not have a traditional 'velocity' vector to dictate their geometry alignment. To solve this, the compute shader saves the projected 3D position from the *previous* frame into the buffer. The vertex shader then subtracts the previous position from the current position to calculate the flow delta, stretching the geometry into sleek, directional streaks."
        },
        {
            heading: "Post-Processing: Anamorphic Lens Flares",
            text: "To give the complex mathematical visualization a stylized, cinematic sci-fi atmosphere, the post-processing shader generates <strong>Anamorphic Horizontal Streaks</strong>. It isolates exclusively high-luminance pixels and samples them horizontally across the screen, applying a decay weight and tinting them cyan. This mimics the optical artifacts produced by anamorphic lenses commonly used in filmmaking, compressing the aspect ratio on the camera sensor. The scene is finished with <strong>ACES Film Tonemapping</strong> to handle the extreme brightness of the core fibers."
        }
    ]
};