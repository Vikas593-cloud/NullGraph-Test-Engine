// demos/WebGPUExperiments/LabyrinthChaos/postProcessShaders.ts

export const cherenkovAnamorphicPostProcess = `
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
        let keepAliveEcs = ecs[0] * 0.0;
        let keepAlive = camera.viewProj[0][0] * 0.0; 
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    // ACES Filmic Tonemapping
    fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
        let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        
        // 1. LENS DISTORTION (Barrel Distortion)
        let delta = uv - center;
        let distSq = dot(delta, delta);
        let distortedUV = center + delta * (1.0 - distSq * 0.2); 

        // 2. CHROMATIC ABERRATION (Spectral Shift)
        let caSpread = 0.008 * distSq; // Worse at the edges
        let colorR = textureSample(screenTex, screenSamp, distortedUV + vec2<f32>(caSpread, 0.0)).r;
        let colorG = textureSample(screenTex, screenSamp, distortedUV).g;
        let colorB = textureSample(screenTex, screenSamp, distortedUV - vec2<f32>(caSpread, 0.0)).b;
        var baseColor = vec3<f32>(colorR, colorG, colorB);

        // 3. ANAMORPHIC FLARE (Horizontal Light Streaks)
        let SAMPLES = 16;
        let threshold = 1.5; // Only streak very bright pixels
        var flare = vec3<f32>(0.0);
        let spreadX = 0.015;
        
        for (var i = -SAMPLES; i <= SAMPLES; i++) {
            let offset = vec2<f32>(f32(i) * spreadX, 0.0);
            let sUV = distortedUV + offset;
            
            if (sUV.x > 0.0 && sUV.x < 1.0) {
                // ADD 'Level' and pass 0.0 as the final argument
                let samp = textureSampleLevel(screenTex, screenSamp, sUV, 0.0).rgb;
                
                let luma = dot(samp, vec3<f32>(0.299, 0.587, 0.114));
                if (luma > threshold) {
                    flare += (samp - threshold) * vec3<f32>(0.1, 0.3, 1.0) * (1.0 - abs(f32(i)) / f32(SAMPLES));
                }
            }
        }

        // 4. VIGNETTE & FILM GRAIN
        var finalColor = baseColor + (flare * 0.6);
        let vignette = 1.0 - smoothstep(0.4, 1.5, length(distortedUV - center));
        finalColor *= vignette;

        // Simple high-frequency noise for grain
        let noise = fract(sin(dot(distortedUV, vec2<f32>(12.9898, 78.233))) * 43758.5453);
        finalColor += (vec3<f32>(noise) - 0.5) * 0.04;

        // 5. TONEMAPPING
        finalColor = ACESFilm(finalColor * 1.2);

        return vec4<f32>(finalColor, 1.0);
    }
`;