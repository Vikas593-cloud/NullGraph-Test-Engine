 struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>; // Passes time

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
        let _keepCameraAlive = camera.viewProj[0][0];
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
        out.uv = uv[vIdx];
        return out;
    }

    // ACES Filmic Tone Mapping Curve
    fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
        let a = 2.51; let b = vec3<f32>(0.03); let c = 2.43; let d = vec3<f32>(0.59); let e = vec3<f32>(0.14);
        return clamp((x*(a*x+b))/(x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];

        // --- 1. VOLUMETRIC LIGHT SCATTERING (GOD RAYS) ---
        let NUM_SAMPLES = 50u;
        let decay = 0.95;
        let density = 0.6;
        let weight = 0.04;

        let lightPosOnScreen = vec2<f32>(0.5, 0.5); // Radiating from dead center
        var deltaTextCoord = (uv - lightPosOnScreen) * (1.0 / f32(NUM_SAMPLES)) * density;

        var currentUV = uv;
        var godRayColor = textureSample(screenTex, screenSamp, currentUV).rgb;
        var illuminationDecay = 1.0;

        for(var i = 0u; i < NUM_SAMPLES; i = i + 1u) {
            currentUV -= deltaTextCoord;
            var sampleColor = textureSample(screenTex, screenSamp, currentUV).rgb;
            sampleColor *= illuminationDecay * weight;
            godRayColor += sampleColor;
            illuminationDecay *= decay;
        }

        // --- 2. CHROMATIC ABERRATION (Distortion at edges) ---
        let distFromCenter = length(uv - 0.5);
        let caStrength = smoothstep(0.2, 0.8, distFromCenter) * 0.015;
        let caR = textureSample(screenTex, screenSamp, uv + vec2<f32>(caStrength, 0.0)).r;
        let caB = textureSample(screenTex, screenSamp, uv - vec2<f32>(caStrength, 0.0)).b;

        // Combine Base + CA + GodRays
        var finalColor = vec3<f32>(caR, godRayColor.g, caB);
        finalColor += godRayColor * 0.7; // Mix the rays back in

        // --- 3. ACES TONEMAPPING (Tames the HDR blowouts into rich colors) ---
        finalColor = ACESFilm(finalColor * 1.2); // 1.2 Exposure

        // --- 4. FILM GRAIN ---
        let noise = fract(sin(dot(uv.xy + time, vec2<f32>(12.9898, 78.233))) * 43758.5453);
        finalColor += vec3<f32>(noise * 0.04);

        return vec4<f32>(finalColor, 1.0);
    }