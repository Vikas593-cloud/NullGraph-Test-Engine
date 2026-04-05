export const acousticBloomShader = `
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

    // Fast 9-tap blur for blooming the neon cyan lines
    fn getGlow(uv: vec2<f32>) -> vec3<f32> {
        let texelSize = 1.0 / vec2<f32>(1920.0, 1080.0); // Rough approximation, avoids needing uniform uploads
        var glow = vec3<f32>(0.0);
        let spread = 3.0;

        for(var x: i32 = -1; x <= 1; x++) {
            for(var y: i32 = -1; y <= 1; y++) {
                let offset = vec2<f32>(f32(x), f32(y)) * texelSize * spread;
                let sampleColor = textureSample(screenTex, screenSamp, uv + offset).rgb;
                // Threshold: Only blur very bright pixels (the cyan lines)
                let brightness = dot(sampleColor, vec3<f32>(0.2126, 0.7152, 0.0722));
                if (brightness > 0.85) {
                    glow += sampleColor;
                }
            }
        }
        return glow / 9.0;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        let centerDist = length(uv - vec2<f32>(0.5, 0.5));
        
        // 1. Chromatic Aberration (Sound Distorting the Lens)
        // Pulses slightly with the sine wave of the time
        let caStrength = 0.001 + (sin(time * 2.0) * 0.002);
        let dir = normalize(uv - vec2<f32>(0.5, 0.5));
        
        let r = textureSample(screenTex, screenSamp, uv + dir * caStrength).r;
        let g = textureSample(screenTex, screenSamp, uv).g;
        let b = textureSample(screenTex, screenSamp, uv - dir * caStrength).b;
        var baseColor = vec3<f32>(r, g, b);

        // 2. Bloom / Glow
        let bloomColor = getGlow(uv) * 1.5; 
        baseColor += bloomColor;

        // 3. Vignette (Focuses the eye on the center of the plate)
        let vignette = 1.0 - smoothstep(0.3, 1.0, centerDist);
        baseColor *= vignette;

        // 4. ACES Film Tonemapping
        let a = 2.51;
        let b_val = 0.03;
        let c = 2.43;
        let d = 0.59;
        let e = 0.14;
        let finalColor = clamp((baseColor*(a*baseColor+b_val))/(baseColor*(c*baseColor+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));

        return vec4<f32>(finalColor, 1.0);
    }
`;