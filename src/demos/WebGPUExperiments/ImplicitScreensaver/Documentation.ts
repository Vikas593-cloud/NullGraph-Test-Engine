import { DemoMetadata } from "../../../types"; // Adjust import path as needed

export const implicitScreensaverDocumentation: DemoMetadata = {
    title: "Implicit Surfaces & Ray Marching",
    concepts: [
        "Ray Marching",
        "Signed Distance Fields (SDFs)",
        "Space Folding",
        "Smooth Minimum Blending"
    ],
    sections: [
        {
            heading: "Overview: Rendering Without Polygons",
            isOpen: true,
            text: "Traditional 3D engines use rasterization: converting thousands of flat triangles into pixels. <strong>Ray Marching</strong> is completely different. We send exactly <em>zero</em> 3D geometry to the GPU. Instead, we draw a single flat square across the entire screen and shoot a virtual 'ray' out of every single pixel. The 3D scene is defined entirely by pure mathematical equations in the Fragment Shader."
        },
        {
            heading: "Signed Distance Fields (SDFs)",
            text: "To figure out if our ray hits anything, we use SDFs. An SDF is a function that takes a 3D point in space and returns the exact distance to the nearest surface. If the distance is positive, you are outside the object. If it's negative, you are inside. If it's exactly <code>0.0</code>, you are touching the surface.",
            code: `// The math for a perfect sphere
fn sdSphere(p: vec3<f32>, radius: f32) -> f32 {
    // Distance from center minus the radius
    return length(p) - radius;
}`
        },
        {
            heading: "The Ray Marching Loop",
            text: "Because we know the distance to the nearest object, we know it is safe to march our ray forward by exactly that amount without accidentally passing through anything. We repeat this step inside a loop. If the distance to the surface becomes almost zero (<code>SURF_DIST</code>), we have a hit! If the ray travels too far (<code>MAX_DIST</code>), we assume it escaped into the empty void.",
            code: `var t = 0.0; // Total distance traveled
for(var i = 0u; i < MAX_STEPS; i++) {
    let p = ro + rd * t;        // Current point along the ray
    let d = map(p, time);       // Distance to nearest surface anywhere
    
    t += d;                     // March forward safely

    if (d < 0.001) { hit = true; break; } // Hit!
    if (t > 100.0) { break; }             // Miss!
}`
        },
        {
            heading: "Smooth Blending (The 'Goo' Effect)",
            text: "One of the biggest advantages of SDFs over traditional polygons is how easily you can combine shapes. Using a mathematical trick called a <strong>Smooth Minimum</strong> (<code>smin</code>), we can blend the distances of a sphere and a twisting box together. As they get close, the math naturally creates a gooey, organic bridge between them.",
            code: `// Blends shape A and shape B together
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// In the map function:
return smin(sphereDist, boxDist, 0.8 * anim + 0.2);`
        },
        {
            heading: "Infinite Space Folding",
            text: "How do we render an infinite grid of these morphing shapes without melting the GPU? We fold space! By using the modulo operator (or rounding), we can mathematically trick the ray into thinking space wraps around on itself every few units. We get infinite repeating geometry for the computational cost of just one shape.",
            code: `// Fold space to create an infinite grid
let spacing = 6.0;

// Wraps the 3D coordinate around every 6 units
let q = pos - spacing * round(pos / spacing); 

// Now pass 'q' into your shape functions instead of 'pos'!
let sphere = sdSphere(q, 1.2);`
        }
    ]
};