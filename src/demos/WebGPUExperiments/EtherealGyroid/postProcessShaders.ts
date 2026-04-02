export const chromaticAberrationPostProcess = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    @group(1) @binding(0) var screenTex: texture_2d<f32>;
    @group(1) @binding(1) var screenSamp: sampler;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
        var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0));
        var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
        
        var out: VertexOut;
        let keepAlive = camera.viewProj[0][0] * 0.0 + ecs[0] * 0.0; 
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let distFromCenter = length(uv - center);
        
        // Chromatic Aberration strength increases towards the edges of the screen
        let aberrationAmount = pow(distFromCenter, 2.0) * 0.03;

        let dir = normalize(uv - center);
        
        // Sample Red, Green, and Blue channels at slightly different offsets
        let r = textureSample(screenTex, screenSamp, uv - dir * aberrationAmount).r;
        let g = textureSample(screenTex, screenSamp, uv).g;
        let b = textureSample(screenTex, screenSamp, uv + dir * aberrationAmount).b;

        var color = vec3<f32>(r, g, b);

        // Soft, cheap radial glow (simulating lens flare/scattering)
        let glowSample = textureSample(screenTex, screenSamp, uv).rgb;
        let luminance = dot(glowSample, vec3<f32>(0.299, 0.587, 0.114));
        let glowMask = smoothstep(1.5, 3.0, luminance); // Extract bright parts
        
        color += glowMask * vec3<f32>(1.2, 1.0, 1.5) * 0.5;

        // Cinematic contrast curve
        color = smoothstep(vec3<f32>(0.0), vec3<f32>(1.0), color);
        color = pow(color, vec3<f32>(0.85)); // slight gamma crush

        // Vignette
        color *= 1.0 - smoothstep(0.5, 1.5, distFromCenter);

        return vec4<f32>(color, 1.0);
    }
`;