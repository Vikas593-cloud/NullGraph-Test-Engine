export const hologramPostProcessShader = `
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
        
        let keepAlive = camera.viewProj[0][0] * 0.0; 
        
        var out: VertexOut;
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        
        // Chromatic Aberration Offset based on distance from center
        let centerDist = length(uv - vec2<f32>(0.5));
        let offset = 0.005 * centerDist;

        let r = textureSample(screenTex, screenSamp, uv + vec2<f32>(offset, 0.0)).r;
        let g = textureSample(screenTex, screenSamp, uv).g;
        let b = textureSample(screenTex, screenSamp, uv - vec2<f32>(offset, 0.0)).b;

        var color = vec3<f32>(r, g, b);

        // Subtle Holographic Scanlines
        let scanline = sin(uv.y * 800.0 - time * 10.0) * 0.04;
        color -= vec3<f32>(scanline);

        // Very slight vignette to frame the nebula
        color *= 1.0 - (centerDist * 0.5);

        // ACES Tonemapping for a punchy contrast
        let a = 2.51;
        let b_val = 0.03;
        let c = 2.43;
        let d = 0.59;
        let e = 0.14;
        color = clamp((color*(a*color+b_val))/(color*(c*color+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));

        return vec4<f32>(color, 1.0);
    }
`;