export const deferredLightingShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    // Assuming null-graph binds the array sequentially
    @group(1) @binding(0) var texAlbedo: texture_2d<f32>;
    @group(1) @binding(1) var texNormal: texture_2d<f32>;
    @group(1) @binding(2) var texPosition: texture_2d<f32>;
    @group(1) @binding(3) var texSampler: sampler;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
        // Full screen triangle
        var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0));
        var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
        
        var out: VertexOut;
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
        out.uv = uv[vIdx];
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];

        // Sample G-Buffer
        let albedo = textureSample(texAlbedo, texSampler, uv).rgb;
        let normal = textureSample(texNormal, texSampler, uv).rgb;
        let worldPos = textureSample(texPosition, texSampler, uv).rgb;

        // Background / Sky check (if normal is exactly zero, we likely hit empty space)
        if (length(normal) < 0.1) {
            return vec4<f32>(0.05, 0.05, 0.08, 1.0); // Dark void
        }

        let viewDir = normalize(camera.eye - worldPos);
        var finalColor = vec3<f32>(0.0);
        
        // 1. Ambient Light
        finalColor += albedo * 0.1;

        // 2. Dynamic Point Lights (Animating in a circle)
        let lightColors = array<vec3<f32>, 3>(
            vec3<f32>(1.0, 0.2, 0.2), // Red
            vec3<f32>(0.2, 1.0, 0.2), // Green
            vec3<f32>(0.2, 0.2, 1.0)  // Blue
        );

        for (var i = 0u; i < 3u; i = i + 1u) {
            let offset = f32(i) * 2.094; // 120 degrees apart
            let lightPos = vec3<f32>(
                sin(time * 2.0 + offset) * 50.0,
                20.0 + sin(time * 3.0 + offset) * 10.0,
                cos(time * 2.0 + offset) * 50.0
            );

            let lightDir = lightPos - worldPos;
            let distance = length(lightDir);
            let dir = normalize(lightDir);

            // Attenuation (Falloff)
            let attenuation = 1.0 / (1.0 + 0.04 * distance + 0.001 * (distance * distance));

            // Diffuse
            let diff = max(dot(normal, dir), 0.0);
            
            // Specular (Blinn-Phong)
            let halfwayDir = normalize(dir + viewDir);
            let spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);

            finalColor += (albedo * diff + spec) * lightColors[i] * attenuation * 300.0;
        }

        // Simple tone mapping
        finalColor = finalColor / (finalColor + vec3<f32>(1.0));
        // Gamma correction
        finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));

        return vec4<f32>(finalColor, 1.0);
    }
`;