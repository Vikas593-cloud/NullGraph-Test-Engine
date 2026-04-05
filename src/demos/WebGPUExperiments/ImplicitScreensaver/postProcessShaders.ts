export const anamorphicDispersionPostProcess = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>; // Contains time at index 0

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
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
        out.uv = uv[vIdx];
        return out;
    }

    fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
        let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        
        // 1. CHROMATIC ABERRATION (Spectral shift on the edges)
        // Pushes Red channel inward, Blue channel outward based on screen distance
        let center = vec2<f32>(0.5, 0.5);
        let dist = length(uv - center);
        let caAmount = smoothstep(0.2, 1.0, dist) * 0.008;

        let rSample = textureSample(screenTex, screenSamp, uv + vec2<f32>(caAmount, 0.0)).r;
        let gSample = textureSample(screenTex, screenSamp, uv).g;
        let bSample = textureSample(screenTex, screenSamp, uv - vec2<f32>(caAmount, 0.0)).b;
        var baseColor = vec3<f32>(rSample, gSample, bSample);

        // 2. ANAMORPHIC LENS FLARES (Horizontal Streaking)
        // 2. ANAMORPHIC LENS FLARES (Horizontal Streaking)
        var flare = vec3<f32>(0.0);
        
        // More samples, but much tighter together
        let flareSamples = 120; 
        let flareSpread = 0.0008; // Samples almost adjacent pixels (no gaps!)
        let flareThreshold = 0.85; // Lowered slightly so the core glows more richly
        
        for(var i = -flareSamples; i <= flareSamples; i++) {
            if (i == 0) { continue; }
            let offset = vec2<f32>(f32(i) * flareSpread, 0.0);
            var samp = textureSample(screenTex, screenSamp, uv + offset).rgb;
            
            let luma = dot(samp, vec3<f32>(0.299, 0.587, 0.114));
            let excess = max(0.0, luma - flareThreshold);
            
            if (excess > 0.0) {
                let weight = 1.0 - (abs(f32(i)) / f32(flareSamples));
                let exponentialWeight = pow(weight, 2.0); // Smoother, wider falloff
                
                // Boosted the intensity slightly since the steps are smaller
                flare += (samp * excess) * exponentialWeight * vec3<f32>(0.1, 0.5, 1.0) * 0.004;
            }
        }

        // 3. CINEMATIC FILM GRAIN
        // High frequency noise pattern to break up the deep blacks
        let noise = fract(sin(dot(uv * time, vec2<f32>(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
        let grain = vec3<f32>(noise) * 0.02;

        // 4. COMPOSITING
        var finalColor = baseColor + flare + grain;

        // Apply ACES Tonemapping
        finalColor = ACESFilm(finalColor * 1.3);

        return vec4<f32>(finalColor, 1.0);
    }
`;