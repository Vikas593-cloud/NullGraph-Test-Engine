export const customSkinnedPBRShader = `
    const PI: f32 = 3.14159265359;

    // ==========================================
    // BINDINGS & STRUCTS
    // ==========================================
    struct Camera { 
        viewProj: mat4x4<f32>, 
        eyePos: vec3<f32>, 
        simTime: f32 
    };

    // Group 0: Engine Data
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    // Group 1: Material Data (Matches our 3 textures + 1 sampler array)
    @group(1) @binding(0) var texAlbedo: texture_2d<f32>;
    @group(1) @binding(1) var texNormal: texture_2d<f32>;
    @group(1) @binding(2) var texMRAO: texture_2d<f32>;
    @group(1) @binding(3) var samp: sampler;

    // Group 2: Skeletal Data
    struct Skeleton { boneMatrices: array<mat4x4<f32>, 70> };
    @group(2) @binding(0) var<uniform> skeleton: Skeleton;

    struct VertexOut {
        @builtin(position) clipPos: vec4<f32>,
        @location(0) worldPos: vec3<f32>,
        @location(1) worldNormal: vec3<f32>,
        @location(2) uv: vec2<f32>,
    };

    // ==========================================
    // VERTEX SHADER (Skinning + MVP)
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

        // 2. Deform position and normal
        let skinnedPos = skinMatrix * vec4<f32>(localPos, 1.0);
        let skinnedNormal = skinMatrix * vec4<f32>(normal, 0.0);

        // 3. Apply World Transform
        let worldPosition = (skinnedPos.xyz * ecsScale) + ecsPos;

        var out: VertexOut;
        out.clipPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.worldPos = worldPosition;
        out.worldNormal = normalize(skinnedNormal.xyz);
        out.uv = uv;
        return out;
    }

    // ==========================================
    // PBR MATH FUNCTIONS (Cook-Torrance BRDF)
    // ==========================================
    fn DistributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
        let a = roughness * roughness;
        let a2 = a * a;
        let NdotH = max(dot(N, H), 0.0);
        let NdotH2 = NdotH * NdotH;
        let num = a2;
        var denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        return num / denom;
    }

    fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
        let r = (roughness + 1.0);
        let k = (r * r) / 8.0;
        let num = NdotV;
        let denom = NdotV * (1.0 - k) + k;
        return num / denom;
    }

    fn GeometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
        let NdotV = max(dot(N, V), 0.0);
        let NdotL = max(dot(N, L), 0.0);
        let ggx2 = GeometrySchlickGGX(NdotV, roughness);
        let ggx1 = GeometrySchlickGGX(NdotL, roughness);
        return ggx1 * ggx2;
    }

    fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }

    // Screen-Space Tangent Generator
    fn getNormalFromMap(uv: vec2<f32>, worldPos: vec3<f32>, worldNormal: vec3<f32>) -> vec3<f32> {
        let tangentNormal = textureSample(texNormal, samp, uv).xyz * 2.0 - 1.0;
        let Q1 = dpdx(worldPos);
        let Q2 = dpdy(worldPos);
        let st1 = dpdx(uv);
        let st2 = dpdy(uv);
        let N = normalize(worldNormal);
        let T = normalize(Q1 * st2.y - Q2 * st1.y);
        let B = -normalize(cross(N, T)); 
        let TBN = mat3x3<f32>(T, B, N);
        return normalize(TBN * tangentNormal);
    }

    // ==========================================
    // FRAGMENT SHADER
    // ==========================================
    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        // 1. Sample Textures
        let albedo = textureSample(texAlbedo, samp, in.uv).rgb;
        let packedData = textureSample(texMRAO, samp, in.uv); 
        
        // standard glTF packing: Red = AO, Green = Roughness, Blue = Metallic
        let ao = packedData.r; 
        let roughness = packedData.g; 
        let metallic = packedData.b;
        
        // 2. Calculate Core Vectors
        let N = getNormalFromMap(in.uv, in.worldPos, in.worldNormal);
        let V = normalize(camera.eyePos - in.worldPos);
        
        var F0 = vec3<f32>(0.04); 
        F0 = mix(F0, albedo, metallic);

        // 3. Light Setup
        var Lo = vec3<f32>(0.0);
        let lightDir = normalize(vec3<f32>(1.0, 1.0, 0.5));
        let lightColor = vec3<f32>(3.0, 3.0, 3.0); 
        
        let L = lightDir;
        let H = normalize(V + L); 
        let radiance = lightColor; 

        // 4. BRDF Math
        let NDF = DistributionGGX(N, H, roughness);   
        let G   = GeometrySmith(N, V, L, roughness);      
        let F   = fresnelSchlick(max(dot(H, V), 0.0), F0);       

        let numerator    = NDF * G * F;
        let denominator  = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; 
        let specular     = numerator / denominator;

        let kS = F;
        var kD = vec3<f32>(1.0) - kS;
        kD *= 1.0 - metallic; 

        let NdotL = max(dot(N, L), 0.0);
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;

        // 5. Ambient Lighting & Tonemapping
        let ambient = vec3<f32>(0.3) * albedo * ao;
        var finalColor = ambient + Lo;

        finalColor = finalColor / (finalColor + vec3<f32>(1.0));
        finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));

        return vec4<f32>(finalColor, 1.0);
    }
`;