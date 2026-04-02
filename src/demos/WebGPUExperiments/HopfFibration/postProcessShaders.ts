export const anamorphicPostProcessShader = `
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
        let keepAlive = camera.viewProj[0][0] * 0.0; 
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        let center = vec2<f32>(0.5, 0.5);
        let dirFromCenter = uv - center;
        let distSq = dot(dirFromCenter, dirFromCenter);

        // 1. CHROMATIC ABERRATION (RGB Shift)
        // Red shifts inward, Blue shifts outward based on distance from center
        let shiftStrength = 0.03 * distSq;
        let rUV = uv - dirFromCenter * shiftStrength;
        let gUV = uv;
        let bUV = uv + dirFromCenter * shiftStrength;

        var color = vec3<f32>(
            textureSample(screenTex, screenSamp, rUV).r,
            textureSample(screenTex, screenSamp, gUV).g,
            textureSample(screenTex, screenSamp, bUV).b
        );

        // 2. ANAMORPHIC HORIZONTAL STREAK (Flares)
        var flare = vec3<f32>(0.0);
        let samples = 12.0;
        let streakWidth = 0.15; // How far the streak goes left/right
        
        for (var i = -12; i <= 12; i = i + 1) {
            let offset = (f32(i) / samples) * streakWidth;
            let sampleUV = uv + vec2<f32>(offset, 0.0);
            
            // Only streak the VERY bright pixels
            let sColor = textureSample(screenTex, screenSamp, sampleUV).rgb;
            let luma = dot(sColor, vec3<f32>(0.299, 0.587, 0.114));
            
            if (luma > 1.5) {
                // Weight drops off further from the center pixel
                let weight = 1.0 - abs(f32(i) / samples);
                // Tint the streak slightly cyan/blue for that sci-fi look
                flare += sColor * weight * vec3<f32>(0.2, 0.5, 1.0) * 0.1;
            }
        }
        color += flare;

        // 3. SCANLINES & VIGNETTE
        let scanline = sin(uv.y * 800.0) * 0.04; 
        color -= vec3<f32>(scanline);
        
        let vignette = 1.0 - smoothstep(0.4, 0.9, length(dirFromCenter));
        color *= vignette;

        // 4. ACES FILM TONEMAPPING (Crunchier and more cinematic than Uncharted 2)
        let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
        color = (color * (a * color + b)) / (color * (c * color + d) + e);

        return vec4<f32>(color, 1.0);
    }
`;