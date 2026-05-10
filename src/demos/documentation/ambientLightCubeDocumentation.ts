import {DemoMetadata} from "../../types";


export const ambientLightCubeDocumentation: DemoMetadata = {
    title: "Instanced Cubes with Lighting",
    concepts: [
        "Lighting & Shading",
        "Surface Normals",
        "Dot Product Math",
        "Fragment Shaders",
        "Instanced Rendering"
    ],
    sections: [
        {
            heading: "Overview",
            isOpen: true,
            text: "Building upon the foundation of instanced rendering, this demo introduces a basic lighting model to give the cubes 3D volume and depth. By utilizing surface normals and calculating diffuse and ambient lighting in the fragment shader, the flat-looking cubes are transformed into tangible 3D objects reacting to a simulated sun."
        },
        {
            heading: "Geometry Layout & Normals",
            text: "To calculate lighting, the GPU needs to know which direction each face of the cube is pointing. This is achieved by switching the geometry from a simple position-only layout to a <code>StandardLayout</code>, which includes normal vectors for every vertex.",
            code: `// Create a cube using StandardLayout to generate normals
const cubeGeom = Primitives.createCube(StandardLayout, 1.0, 1.0, 1.0);
cubeGeom.upload(engine);

const cubeBatch = engine.createBatch(mainPass, {
    shaderCode: shaderSource,
    strideFloats: 14,
    maxInstances: MAX_INSTANCES,
    // The pipeline now expects both position and normal attributes
    vertexLayouts: cubeGeom.layout.getWebGPUDescriptor() 
});`
        },
        {
            heading: "Passing Normals in the Vertex Shader",
            text: "The vertex shader is updated to accept the new normal data from the geometry buffer at <code>@location(1)</code>. It simply passes this normal vector straight through to the fragment shader via the output struct. If the instances had individual rotations stored in the ECS data, the normals would need to be multiplied by a rotation matrix here.",
            code: `struct VertexOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>, // Pass normal to fragment shader!
};

@vertex
fn vs_main(
    @location(0) localPos: vec3<f32>,
    @location(1) localNormal: vec3<f32>, // Grab normal from geometry buffer
    @builtin(instance_index) iIdx: u32
) -> VertexOut {
    // ... [Position and color fetching logic] ...

    var out: VertexOut;
    out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
    out.color = color;
    out.normal = localNormal; 
    return out;
}`
        },
        {
            heading: "Calculating Diffuse Lighting",
            text: "The core lighting math happens in the fragment shader. It calculates how directly the simulated sunlight hits a surface using the <strong>Dot Product</strong> of the light direction and the surface normal. An ambient light value is also added to ensure the dark sides of the cubes don't render pitch black.",
            code: `@fragment
fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
    // 1. Define Sunlight Direction (coming from top-right-front)
    let sunDir = normalize(vec3<f32>(1.0, 1.5, 0.5));
    
    // 2. Base ambient light so shadows aren't pitch black
    let ambient = 0.3; 
    
    // 3. Dot Product Math: How directly is the light hitting this face?
    // max() prevents negative light values on the dark side
    let diffuse = max(dot(normal, sunDir), 0.0); 

    // 4. Combine! Base color * (ambient light + direct light)
    let finalColor = color * (ambient + diffuse);
    
    return vec4<f32>(finalColor, 1.0);
}`
        }
    ]
};