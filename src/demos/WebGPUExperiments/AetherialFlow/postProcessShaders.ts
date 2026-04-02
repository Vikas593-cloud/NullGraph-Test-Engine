export const bokehBloomPostProcessShader = `
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
        
        // CRITICAL FIX: Force the compiler to keep the camera binding alive
        // by making the output position mathematically dependent on it.
        let keepAlive = camera.viewProj[0][0] * 0.0; 
        
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    // Strictly typed Uncharted 2 Tonemap (Prevents scalar/vector math panics)
    fn Uncharted2Tonemap(x: vec3<f32>) -> vec3<f32> {
        let A: f32 = 0.15; let B: f32 = 0.50; let C: f32 = 0.10; let D: f32 = 0.20; let E: f32 = 0.02; let F: f32 = 0.30;
        let CB = vec3<f32>(C * B);
        let DE = vec3<f32>(D * E);
        let DF = vec3<f32>(D * F);
        let EF = vec3<f32>(E / F);
        return ((x * (A * x + CB) + DE) / (x * (A * x + vec3<f32>(B)) + DF)) - EF;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        let center = vec2<f32>(0.5, 0.5);
        let distFromCenter = length(uv - center);

        let blurAmount = smoothstep(0.1, 0.8, distFromCenter) * 0.02;
        var color = vec3<f32>(0.0);
        var totalWeight = 0.0;
        
        // Strictly typed integer loops mapped to floats
        for (var x: i32 = -2; x <= 2; x = x + 1) {
            for (var y: i32 = -2; y <= 2; y = y + 1) {
                let fx = f32(x);
                let fy = f32(y);
                let offset = vec2<f32>(fx, fy) * blurAmount;
                let sampleUV = uv + offset;
                
                let distSq = fx * fx + fy * fy;
                let weight = exp(-distSq / 4.0);
                
                let texSample = textureSample(screenTex, screenSamp, sampleUV);
                let glow = max(texSample.rgb - vec3<f32>(0.8), vec3<f32>(0.0)) * 1.5;
                
                color += (texSample.rgb + glow) * weight;
                totalWeight += weight;
            }
        }
        color /= totalWeight;

        let vignette = 1.0 - smoothstep(0.4, 1.2, distFromCenter);
        color *= vignette;

        let exposure = 1.8; 
        color = Uncharted2Tonemap(color * exposure);
        
        let whiteScale = vec3<f32>(1.0) / Uncharted2Tonemap(vec3<f32>(11.2)); 
        color *= whiteScale;

        return vec4<f32>(color, 1.0);
    }
`;