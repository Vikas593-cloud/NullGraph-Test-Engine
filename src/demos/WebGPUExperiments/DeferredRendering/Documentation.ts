import { DemoMetadata } from "../../../types"; // Adjust import path as needed

export const deferredRenderingDocumentation: DemoMetadata = {
    title: "Deferred Rendering & Cinematic Post-Processing",
    concepts: [
        "Deferred Shading",
        "G-Buffers",
        "Volumetric Scattering",
        "ACES Tonemapping"
    ],
    sections: [
        {
            heading: "Overview: The Deferred Paradigm",
            isOpen: true,
            text: "In traditional <em>Forward Rendering</em>, lighting is calculated for every triangle as it is drawn. If many triangles overlap, the GPU wastes time calculating light for pixels that are eventually hidden. <strong>Deferred Rendering</strong> solves this by splitting the process into two steps: first, we record the physical properties of the scene (Geometry Pass), and second, we calculate the lighting for the visible pixels all at once (Lighting Pass)."
        },
        {
            heading: "1. The Geometry Pass (G-Buffer)",
            text: "Instead of outputting final colors, the first shader writes to multiple high-precision textures simultaneously. This collection of textures is called the <strong>G-Buffer</strong> (Geometry Buffer). We store the unlit color (Albedo), the surface direction (Normal), and the exact 3D world coordinate (Position) of every visible pixel.",
            code: `// The G-Buffer Output Structure
struct GBufferOutput {
    @location(0) albedo: vec4<f32>,
    @location(1) normal: vec4<f32>,
    @location(2) position: vec4<f32>
};

@fragment
fn fs_main(in: VertexOut) -> GBufferOutput {
    var out: GBufferOutput;
    out.albedo = vec4<f32>(in.albedo, 1.0);
    out.normal = vec4<f32>(in.worldNormal, 1.0);
    out.position = vec4<f32>(in.worldPos, 1.0);
    return out;
}`
        },
        {
            heading: "2. The Deferred Lighting Pass",
            text: "Next, we draw a single, flat triangle that covers the entire screen. For each pixel, we read the G-Buffer data and apply our lighting math. In this demo, three point lights (Red, Green, Blue) orbit the scene. Because this is a deferred pass, calculating these dynamic lights is extremely fast—we only do the math for the pixels that are actually visible on screen.",
            code: `// Sampling the G-Buffer to calculate lighting
let albedo = textureSample(texAlbedo, texSampler, uv).rgb;
let normal = textureSample(texNormal, texSampler, uv).rgb;
let worldPos = textureSample(texPosition, texSampler, uv).rgb;

// ... calculate distance and direction ...

// Apply Blinn-Phong Specular and Diffuse Lighting
let diff = max(dot(normal, lightDir), 0.0);
let halfwayDir = normalize(lightDir + viewDir);
let spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);

finalColor += (albedo * diff + spec) * lightColor * attenuation;`
        },
        {
            heading: "3. Volumetric God Rays",
            text: "To simulate light scattering through a dusty or foggy atmosphere, we use a screen-space technique. We sample the rendered image multiple times along a line pointing towards the center of the screen, decaying the brightness with each step. This creates the illusion of <strong>Volumetric Light Scattering</strong> (God Rays).",
            code: `// Volumetric Light Scattering (Screen Space God Rays)
var illumCoord = texCoord;
var illuminationDecay = 1.0;
var godRays = vec3<f32>(0.0);

for(var i = 0; i < NUM_SAMPLES; i++) {
    illumCoord -= deltaTextCoord; // Step towards light source/center
    var samp = textureSample(screenTex, screenSamp, illumCoord).rgb;
    
    // Isolate the brightest pixels to generate rays
    samp *= smoothstep(0.5, 1.5, length(samp)); 
    
    godRays += samp * illuminationDecay * weight;
    illuminationDecay *= decay;
}`
        },
        {
            heading: "4. Photographic Halation & Tonemapping",
            text: "Halation is a visual artifact from vintage analog film where bright highlights bleed red into surrounding dark areas. We simulate this by checking surrounding pixels for high luminance and injecting red/orange. Finally, we pass the entire image through the <strong>ACES Tonemapping Curve</strong> (an industry standard used in film) to gracefully compress ultra-bright HDR values into colors your monitor can display."
        }
    ]
};