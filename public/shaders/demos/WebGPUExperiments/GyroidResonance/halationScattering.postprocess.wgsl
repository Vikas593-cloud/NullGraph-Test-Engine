  struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    @group(1) @binding(1) var screenTex: texture_2d<f32>;
    @group(1) @binding(0) var screenSamp: sampler;

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
        let keepAliveEcs = ecs[0] * 0.0;
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    // ACES Filmic Tonemapping curve
    fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
        let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let texCoord = uv;

        // 1. BASE COLOR SAMPLE
        var baseColor = textureSample(screenTex, screenSamp, texCoord).rgb;

        // 2. VOLUMETRIC LIGHT SCATTERING (GOD RAYS)
        let NUM_SAMPLES = 30;     // Increased for smoother rays
        let density = 1.0;        // Increased spread density
        let weight = 0.18;        // More than doubled the brightness of the rays
        let decay = 0.96;         // Higher decay means rays travel further before fading
        var exposure = 1.0;

        var deltaTextCoord = (texCoord - center);
        deltaTextCoord *= 1.0 / f32(NUM_SAMPLES) * density;

        var illumCoord = texCoord;
        var illuminationDecay = 1.0;
        var godRays = vec3<f32>(0.0);

        for(var i = 0; i < NUM_SAMPLES; i++) {
            illumCoord -= deltaTextCoord;
            var samp = textureSample(screenTex, screenSamp, illumCoord).rgb;

            // LOWER THRESHOLD: Covers mid-tones, not just pure white
            samp *= smoothstep(0.15, 1.0, length(samp));

            godRays += samp * illuminationDecay * weight;
            illuminationDecay *= decay;
        }

        // 3. PHOTOGRAPHIC HALATION (Red Bleed)
        var halation = vec3<f32>(0.0);
        let halationSpread = 0.012; // Wider spread

        // Expanded to a 5x5 kernel for a softer, much more noticeable glow
        for(var x: i32 = -2; x <= 2; x++) {
            for(var y: i32 = -2; y <= 2; y++) {
                let offset = vec2<f32>(f32(x), f32(y)) * halationSpread;
                let hSamp = textureSample(screenTex, screenSamp, texCoord + offset).rgb;

                let luma = dot(hSamp, vec3<f32>(0.299, 0.587, 0.114));

                // LOWER LUMA THRESHOLD: Catch more colors (down from 0.8 to 0.3)
                if (luma > 0.3) {
                    // Stronger base multiplier and richer red/orange tint
                    halation += hSamp * vec3<f32>(1.0, 0.3, 0.1) * 0.4;
                }
            }
        }

        // Normalize the halation so the 5x5 grid doesn't completely blow out the screen
        halation *= 0.1;

        // 4. COMPOSITING & TONEMAPPING
        var finalColor = baseColor + godRays + halation;

        // Subtle Vignette
        let distFromCenter = length(uv - center);
        let vignette = 1.0 - smoothstep(0.3, 1.4, distFromCenter);
        finalColor *= vignette;

        // Apply ACES Tonemapping (Slightly higher boost so the glows pop)
        finalColor = ACESFilm(finalColor * 1.8);

        return vec4<f32>(finalColor, 1.0);
    }