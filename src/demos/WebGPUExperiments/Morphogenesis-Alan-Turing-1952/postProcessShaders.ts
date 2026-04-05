export const kuwaharaPostProcessShader = `
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
        
        // KEEP ALIVE HACK
        let keepAlive = camera.viewProj[0][0] * 0.0 + ecs[0] * 0.0; 
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let texDims = vec2<f32>(textureDimensions(screenTex));
        let texelSize = 1.0 / texDims;
        
        let radius = 2; // Adjust this to change "brush size" (higher = heavier paint)
        
        var m = array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
        var s = array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
        
        // Quadrant 0: Top-Left
        for (var j = -radius; j <= 0; j++) {
            for (var i = -radius; i <= 0; i++) {
                let c = textureSample(screenTex, screenSamp, uv + vec2<f32>(f32(i), f32(j)) * texelSize).rgb;
                m[0] += c; s[0] += c * c;
            }
        }
        // Quadrant 1: Top-Right
        for (var j = -radius; j <= 0; j++) {
            for (var i = 0; i <= radius; i++) {
                let c = textureSample(screenTex, screenSamp, uv + vec2<f32>(f32(i), f32(j)) * texelSize).rgb;
                m[1] += c; s[1] += c * c;
            }
        }
        // Quadrant 2: Bottom-Right
        for (var j = 0; j <= radius; j++) {
            for (var i = 0; i <= radius; i++) {
                let c = textureSample(screenTex, screenSamp, uv + vec2<f32>(f32(i), f32(j)) * texelSize).rgb;
                m[2] += c; s[2] += c * c;
            }
        }
        // Quadrant 3: Bottom-Left
        for (var j = 0; j <= radius; j++) {
            for (var i = -radius; i <= 0; i++) {
                let c = textureSample(screenTex, screenSamp, uv + vec2<f32>(f32(i), f32(j)) * texelSize).rgb;
                m[3] += c; s[3] += c * c;
            }
        }

        let n = f32((radius + 1) * (radius + 1));
        var min_sigma2 = 1e+2;
        var finalColor = vec3<f32>(0.0);

        // Find the quadrant with the lowest variance
        for (var k = 0; k < 4; k++) {
            m[k] /= n;
            s[k] = abs(s[k] / n - m[k] * m[k]);
            
            let sigma2 = s[k].r + s[k].g + s[k].b;
            if (sigma2 < min_sigma2) {
                min_sigma2 = sigma2;
                finalColor = m[k];
            }
        }

        // Chromatic Aberration fringe on the final paint stroke edges
        let centerDist = length(uv - vec2<f32>(0.5));
        let rOffset = texelSize * centerDist * 8.0;
        let gOffset = texelSize * centerDist * -4.0;
        
        let redFringe = textureSample(screenTex, screenSamp, uv + rOffset).r;
        let greenFringe = textureSample(screenTex, screenSamp, uv + gOffset).g;
        
        // Blend the pure paint look with a slight glassy lens edge
        finalColor = mix(finalColor, vec3<f32>(redFringe, greenFringe, finalColor.b), 0.15);

        return vec4<f32>(finalColor, 1.0);
    }
`;