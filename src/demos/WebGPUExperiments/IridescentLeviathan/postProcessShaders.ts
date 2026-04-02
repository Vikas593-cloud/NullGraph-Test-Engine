export const refractionPostProcessShader = `
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
        let keepAlive = camera.viewProj[0][0] * 0.0 + ecs[0] * 0.0; 
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0) + vec4<f32>(keepAlive);
        out.uv = uv[vIdx];
        return out;
    }

    // Procedural Neon Grid Background
    fn getBackground(uv: vec2<f32>, time: f32) -> vec3<f32> {
        var p = uv * 15.0;
        // Wavy distortion
        p.x += sin(p.y * 0.5 + time * 0.5) * 1.5;
        p.y += cos(p.x * 0.5 + time * 0.5) * 1.5;
        
        let grid = abs(fract(p) - 0.5) * 2.0;
        let line = smoothstep(0.85, 0.95, max(grid.x, grid.y));
        
        // Deep purple void with bright pink/cyan glowing lines
        let bgColor = vec3<f32>(0.02, 0.01, 0.05);
        let lineColor = vec3<f32>(1.0, 0.2, 0.7);
        return bgColor + lineColor * line * 0.4;
    }

    // Cosine palette for Iridescence
    fn palette(t: f32) -> vec3<f32> {
        let a = vec3<f32>(0.5, 0.5, 0.5);
        let b = vec3<f32>(0.5, 0.5, 0.5);
        let c = vec3<f32>(1.0, 1.0, 1.0);
        let d = vec3<f32>(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let time = ecs[0];
        let samp = textureSample(screenTex, screenSamp, uv);
        let isParticle = samp.a; // 0.0 if empty, 1.0 if particle
        
        // If we didn't hit a particle, just draw the background void
        if (isParticle < 0.1) {
            return vec4<f32>(getBackground(uv, time), 1.0);
        }

        // 1. DECODE THE NORMAL
        // We encoded it as [0, 1], so we map it back to [-1, 1]
        let normal = normalize(samp.rgb * 2.0 - vec3<f32>(1.0));
        let viewDir = vec3<f32>(0.0, 0.0, 1.0); // Looking straight into screen
        let NdotV = max(dot(normal, viewDir), 0.0);

        // 2. GLASS REFRACTION
        // Use the X/Y tilt of the sphere's normal to bend the UV coordinates behind it
        let refractionStrength = 0.08;
        let refractedUV = uv - normal.xy * refractionStrength;
        let bgBehindGlass = getBackground(refractedUV, time);

        // 3. THIN FILM IRIDESCENCE (Soap Bubble effect)
        // Thickness pulses slowly over time
        let filmThickness = 300.0 + sin(time * 0.5) * 150.0; 
        let phase = filmThickness * NdotV * 0.01;
        let iridescence = palette(phase);

        // 4. FRESNEL & SPECULAR HIGHLIGHT
        // Edges reflect more (Fresnel), center has a sharp glossy highlight (Specular)
        let fresnel = pow(1.0 - NdotV, 3.0);
        let specular = pow(NdotV, 90.0) * 1.5; // Very sharp, bright highlight

        // 5. COMPOSITE
        // The background is visible through the glass, colored by the iridescence, with glossy reflections on top
        var finalColor = mix(bgBehindGlass, iridescence, fresnel * 0.8) + vec3<f32>(specular);

        // Subtle chromatic aberration on the very edges of the spheres
        finalColor.r += normal.x * 0.1;
        finalColor.b -= normal.x * 0.1;

        return vec4<f32>(finalColor, 1.0);
    }
`;