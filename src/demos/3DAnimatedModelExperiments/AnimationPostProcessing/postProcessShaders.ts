export const halationScatteringPostProcess = `
    struct Camera { 
        viewProj: mat4x4<f32>, 
        eyePos: vec3<f32>, 
        simTime: f32 
    };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    @group(1) @binding(0) var screenSamp: sampler;
    @group(1) @binding(1) var screenTex: texture_2d<f32>;
    

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

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let texCoord = uv;
        let time = camera.simTime;
        
        // 1. BASE COLOR
        var baseColor = textureSample(screenTex, screenSamp, texCoord).rgb;

        // ==========================================
        // EFFECT A: INTENSE CORE BLOOM (Radial)
        // ==========================================
        var coreBloom = vec3<f32>(0.0);
        const RADIAL_SAMPLES: i32 = 24;
        const RADIUS: f32 = 0.012; // Keep this tight so it stays near the head
        const GOLDEN_ANGLE: f32 = 2.3999632;
        
        for(var i: i32 = 1; i <= RADIAL_SAMPLES; i++) {
            let fi = f32(i);
            let r = sqrt(fi / f32(RADIAL_SAMPLES)) * RADIUS;
            let theta = fi * GOLDEN_ANGLE;
            let offset = vec2<f32>(cos(theta), sin(theta)) * r * vec2<f32>(1.0, 1.5); 
            
            var samp = textureSampleLevel(screenTex, screenSamp, texCoord + offset, 0.0).rgb;
            
            let brightness = max(samp.r, max(samp.g, samp.b));
            if (brightness > 1.2) {
                // Fades out slightly at the edges of the tiny circle
                let weight = 1.0 - (fi / f32(RADIAL_SAMPLES));
                coreBloom += samp * weight;
            }
        }
        // Multiply by 3.5 to make it really pop and look "high bloom"
        coreBloom = (coreBloom / f32(RADIAL_SAMPLES)) * 3.5; 


        // ==========================================
        // EFFECT B: UPWARD ENERGY AURA (Directional)
        // ==========================================
        var auraGlow = vec3<f32>(0.0);
        const STREAK_SAMPLES: i32 = 50; 
        const STREAK_LENGTH: f32 = 0.18; 

        for(var i: i32 = 0; i < STREAK_SAMPLES; i++) {
            let t = f32(i) / f32(STREAK_SAMPLES); 
            let yOffset = t * STREAK_LENGTH;
            
            // The organic energy wave
            let xOffset = sin(t * 12.0 - time * 5.0) * (t * 0.015);
            let sampleUv = texCoord + vec2<f32>(xOffset, yOffset);
            
            if (sampleUv.y > 1.0) { break; }
            
            var samp = textureSampleLevel(screenTex, screenSamp, sampleUv, 0.0).rgb;
            var sampData = textureSampleLevel(screenTex, screenSamp, sampleUv, 0.0);
            var sampColor = sampData.rgb;
            let brightness = max(samp.r, max(samp.g, samp.b));
            if (brightness > 1.2 && sampData.a > 0.5) {
                let weight = pow(1.0 - t, 2.5); 
                auraGlow += sampColor * weight;
            }
        }
        // Keep the aura bright, but slightly less intense than the blinding core
        auraGlow = (auraGlow / f32(STREAK_SAMPLES)) * 12.0; 


        // ==========================================
        // COMPOSITING & TONEMAPPING
        // ==========================================
        
        // Add Base + Core Bloom + Upward Aura
        var finalColor = baseColor + coreBloom + auraGlow;

        // Lens Vignette
        let center = vec2<f32>(0.5, 0.5);
        let distFromCenter = length(uv - center);
        let vignette = 1.0 - smoothstep(0.4, 1.5, distFromCenter);
        finalColor *= vignette;

        // Exposure Tonemapping
        let exposure = 1.2;
        finalColor = vec3<f32>(1.0) - exp(-finalColor * exposure);

        return vec4<f32>(finalColor, 1.0);
    }
`;