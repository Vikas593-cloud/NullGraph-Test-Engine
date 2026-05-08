export const emissiveHairShader = `
    const PI: f32 = 3.14159265359;

    // ==========================================
    // BINDINGS & STRUCTS
    // ==========================================
    struct Camera { 
        viewProj: mat4x4<f32>, 
        eyePos: vec3<f32>, 
        simTime: f32 
    };
    
    struct MaterialParams {
            baseColor: vec4<f32>,
            metallic: f32,
            roughness: f32,
            mapFormat: f32, 
            padding: f32,
        };

    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    @group(1) @binding(0) var samp: sampler;
    @group(1) @binding(1) var texAlbedo: texture_2d<f32>;
    @group(1) @binding(2) var texNormal: texture_2d<f32>;
    @group(1) @binding(3) var texMRAO: texture_2d<f32>;
    @group(1) @binding(4) var<uniform> material: MaterialParams;

    struct Skeleton { boneMatrices: array<mat4x4<f32>, 70> };
    @group(2) @binding(0) var<uniform> skeleton: Skeleton;

    // ADDED: worldNormal and viewDir for Rim Lighting
    struct VertexOut {
        @builtin(position) clipPos: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) glowColor: vec3<f32>,
        @location(2) worldNormal: vec3<f32>,
        @location(3) viewDir: vec3<f32>,
    };

    // ==========================================
    // VERTEX SHADER
    // ==========================================
    @vertex
    fn vs_main(
        @location(0) localPos: vec3<f32>,   
        @location(1) normal: vec3<f32>,      
        @location(2) uv: vec2<f32>,
        @location(3) joints: vec4<f32>,  
        @location(4) weights: vec4<f32>,         
        @builtin(instance_index) iIdx: u32
    ) -> VertexOut {
        let base = iIdx * 14u;
        let ecsPos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let ecsScale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);

        // 1. Calculate Skin Matrix
        let jx = u32(joints.x); let jy = u32(joints.y);
        let jz = u32(joints.z); let jw = u32(joints.w);

        let skinMatrix = 
            weights.x * skeleton.boneMatrices[jx] +
            weights.y * skeleton.boneMatrices[jy] +
            weights.z * skeleton.boneMatrices[jz] +
            weights.w * skeleton.boneMatrices[jw];

        // 2. Deform position & normal
        let skinnedPos = skinMatrix * vec4<f32>(localPos, 1.0);
        let skinnedNormal = skinMatrix * vec4<f32>(normal, 0.0);

        // 3. Apply World Transform
        var worldPosition = (skinnedPos.xyz * ecsScale) + ecsPos;
        let worldNormal = normalize(skinnedNormal.xyz * ecsScale);

        // 4. ARTSY WIND ANIMATION
        // We use uv.y so the roots stay still and the tips sway.
        // If your hair UVs are inverted (1.0 at root), change this to (1.0 - uv.y)
        let time = camera.simTime;
        let windFreq = 2.5;
        let windAmp = 0.08 * uv.y; 
        
        // Create organic noise based on world position so each strand moves slightly differently
        let windOffset = vec3<f32>(
            sin(time * windFreq + worldPosition.y * 5.0) * 1.2,
            cos(time * windFreq * 0.8 + worldPosition.x * 5.0) * 0.5,
            sin(time * windFreq * 1.2 + worldPosition.z * 5.0) * 1.0
        ) * windAmp;

        worldPosition += windOffset;

        var out: VertexOut;
        out.clipPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.uv = uv; 
        
        // Base glow color
        out.glowColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);
        out.worldNormal = worldNormal;
        out.viewDir = normalize(camera.eyePos - worldPosition);
        
        return out;
    }

    // ==========================================
    // FRAGMENT SHADER
    // ==========================================
    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        let albedo = textureSample(texAlbedo, samp, in.uv).rgb * material.baseColor.rgb;
        let dummyNormal = textureSample(texNormal, samp, in.uv).rgb * 0.0;
        let dummyMRAO = textureSample(texMRAO, samp, in.uv).rgb * 0.0;
        
        // ARTSY RIM GLOW (Fresnel)
        // Makes the edges of the hair glow brighter than the flat center
        let NdotV = max(dot(normalize(in.worldNormal), normalize(in.viewDir)), 0.0);
        let rimIntensity = pow(1.0 - NdotV, 2.5); // The higher the power, the thinner the rim
        
        // Boost the glow on the rim edges
        let enhancedGlow = in.glowColor + (in.glowColor * rimIntensity * 2.0);
        
        // Add subtle pulsing over time based on UV
        // let pulse = (sin(camera.simTime * 3.0 - in.uv.y * 10.0) * 0.5 + 0.5) * 0.2 + 0.8;
        
        let finalColor = (albedo + dummyNormal + dummyMRAO) * enhancedGlow; // * pulse
        
        return vec4<f32>(finalColor, 1.0); 
    }
`;