import {PBRChunks} from "null-graph/materials";
export const butterflyComputeShader = `
    struct IndirectDrawArgs {
        indexCount: u32,
        instanceCount: atomic<u32>, 
        firstIndex: u32,
        baseVertex: u32,
        firstInstance: u32,
    };

    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera; 
    
    // Split the pipeline into Physics (Read/Write) and Render (Write Only)
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;
    
    // Group 1: Material (Attached via StandardPBRMaterial)


    fn quatLookAt(forward: vec3<f32>) -> vec4<f32> {
        let z = normalize(forward);
        var x = cross(vec3<f32>(0.0, 1.0, 0.0), z);
        if (length(x) < 0.001) { x = vec3<f32>(1.0, 0.0, 0.0); }
        x = normalize(x);
        let y = cross(z, x);
        
        let m00 = x.x; let m01 = x.y; let m02 = x.z;
        let m10 = y.x; let m11 = y.y; let m12 = y.z;
        let m20 = z.x; let m21 = z.y; let m22 = z.z;
        
        var q: vec4<f32>;
        let tr = m00 + m11 + m22;
        if (tr > 0.0) {
            let S = sqrt(tr + 1.0) * 2.0; 
            q.w = 0.25 * S; q.x = (m12 - m21) / S; q.y = (m20 - m02) / S; q.z = (m01 - m10) / S;
        } else if ((m00 > m11) && (m00 > m22)) {
            let S = sqrt(1.0 + m00 - m11 - m22) * 2.0; 
            q.w = (m12 - m21) / S; q.x = 0.25 * S; q.y = (m01 + m10) / S; q.z = (m20 + m02) / S;
        } else if (m11 > m22) {
            let S = sqrt(1.0 + m11 - m00 - m22) * 2.0; 
            q.w = (m20 - m02) / S; q.x = (m01 + m10) / S; q.y = 0.25 * S; q.z = (m12 + m21) / S;
        } else {
            let S = sqrt(1.0 + m22 - m00 - m11) * 2.0; 
            q.w = (m01 - m10) / S; q.x = (m20 + m02) / S; q.y = (m12 + m21) / S; q.z = 0.25 * S;
        }
        return normalize(q);
    }

    @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 2000u) { return; } 

        let time = camera.simTime;
        let base = idx * 20u; 

        // READ STATE (From physics buffer)
       let seed = physicsState[base + 0u]; 
        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 11u], physicsState[base + 12u], physicsState[base + 13u]);

        let distFromCenter = length(vec3<f32>(pos.x, 0.0, pos.z));
        var force = vec3<f32>(0.0);

        // 1. SOFT 100x100 BOUNDARY
        // If they fly further than 50 units away from center, gently push them back in
        let maxRadius = 50.0;
        if (distFromCenter > maxRadius) {
            let pullBack = (distFromCenter - maxRadius) * 5.0;
            force -= normalize(vec3<f32>(pos.x, 0.001, pos.z)) * pullBack;
        }

        // 2. TINY CHARACTER AVOIDANCE (Optional)
        // Keep a very small 2-unit bubble so they don't clip directly into the character model
        if (distFromCenter < 1.0) {
            force += normalize(vec3<f32>(pos.x, 0.001, pos.z)) * 50.0;
        }

        // 3. LAZY AIR CURRENTS
        // Instead of a fast swirl, just a very lazy rotation to the space
        var swirl = cross(normalize(vec3<f32>(pos.x, 0.001, pos.z)), vec3<f32>(0.0, 1.0, 0.0));
        force += swirl * 15.0;

        // 4. CHAOTIC FLUTTER (Kept exactly as you had it)
        let nScale = 0.15;
        let nx = sin(pos.y * nScale + time * 3.0 + seed * 100.0);
        let ny = cos(pos.z * nScale + time * 2.5 + seed * 100.0);
        let nz = sin(pos.x * nScale + time * 3.5 + seed * 100.0);
        force += vec3<f32>(nx, ny, nz) * 600.0;
        let preferredHeight = -4.0 + (seed * 40.0);
        force.y -= (pos.y - preferredHeight) * 5.0;
        force *= 0.01;

        let dt = 0.016; 
        vel += force * dt;
        vel *= 0.98; 
        pos += vel * dt;

        let rotQuat = quatLookAt(vel);

        // 1. WRITE BACK TO PHYSICS STATE
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = rotQuat.x; physicsState[base + 5u] = rotQuat.y; physicsState[base + 6u] = rotQuat.z; physicsState[base + 7u] = rotQuat.w;
        physicsState[base + 11u] = vel.x; physicsState[base + 12u] = vel.y; physicsState[base + 13u] = vel.z;

        // 2. CLAIM A SPOT IN THE RENDER BUFFER via Atomic Add
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 20u; // Match your stride

        // 3. COPY ALL 20 FLOATS TO THE RENDER BUFFER
        for(var i = 0u; i < 20u; i = i + 1u) {
            renderData[wBase + i] = physicsState[base + i];
        }
    }
`;

export const butterflyRenderShader = `
    const PI: f32 = 3.14159265359;

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

        // Group 0: Engine Data
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        // Group 1: Material Data
        @group(1) @binding(0) var samp: sampler;
        @group(1) @binding(1) var texAlbedo: texture_2d<f32>;
        @group(1) @binding(2) var texNormal: texture_2d<f32>;
        @group(1) @binding(3) var texMRAO: texture_2d<f32>;
        @group(1) @binding(4) var<uniform> material: MaterialParams;

        
    ${PBRChunks.SkinningBindings}
    ${PBRChunks.PBRMath}

    struct VertexOut {
        @builtin(position) clipPos: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) glowColor: vec3<f32>,
        @location(2) worldNormal: vec3<f32>,
        @location(3) viewDir: vec3<f32>,
        @location(4) seed: f32, // Passed to fragment for random pulsing
    };

    @vertex
    fn vs_main(
        @location(0) localPos: vec3<f32>,   
        @location(1) normal: vec3<f32>,      
        @location(2) uv: vec2<f32>,
        @location(3) joints: vec4<f32>,  
        @location(4) weights: vec4<f32>,         
        @builtin(instance_index) iIdx: u32
    ) -> VertexOut {
        let base = iIdx * 20u; // NEW STRIDE!
        
        let seed = ecs[base]; // Index 0
        let ecsPos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let rotQuat = vec4<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u], ecs[base + 7u]);
        let ecsScale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
        let instColor = vec3<f32>(ecs[base + 14u], ecs[base + 15u], ecs[base + 16u]);
        var animatedPos = localPos;
        let flapSpeed = 40.0;
        let flapPhase = camera.simTime * flapSpeed + (seed * 100.0);
        animatedPos.x *= 0.6 + 0.4 * cos(flapPhase);
        animatedPos.y += sin(flapPhase) * abs(localPos.x) * 0.3;

        // 1. Hardware Skinning (Synced wings)
        let j = vec4<u32>(joints);
        let skinMatrix = weights.x * skeleton.boneMatrices[j.x] +
                         weights.y * skeleton.boneMatrices[j.y] +
                         weights.z * skeleton.boneMatrices[j.z] +
                         weights.w * skeleton.boneMatrices[j.w];

        let skinnedPos = skinMatrix * vec4<f32>(animatedPos, 1.0);
        let skinnedNormal = skinMatrix * vec4<f32>(normal, 0.0);

        // 2. Apply Instance Transform
        let scaledPos = skinnedPos.xyz * ecsScale;
        let rotatedPos = rotateVector(scaledPos, rotQuat);
        var worldPosition = rotatedPos + ecsPos;
        let worldNormal = normalize(rotateVector(skinnedNormal.xyz * ecsScale, rotQuat));

        // 3. PROCEDURAL DESYNC
        // This makes them randomly bob up and down so the synced wing flaps are less obvious
        let time = camera.simTime;
        let flutterSpeed = 30.0;
        let flutterOffset = sin(time * flutterSpeed + seed * 6.28) * 0.2;
        worldPosition.y += flutterOffset;

        var out: VertexOut;
        out.clipPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.uv = uv; 
        out.glowColor = instColor; 
        out.worldNormal = worldNormal;
        out.viewDir = normalize(camera.eyePos - worldPosition);
        out.seed = seed;
        
        return out;
    }

    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        // Read Albedo, drop if transparent
        let albedoMap = textureSample(texAlbedo, samp, in.uv);
        if (albedoMap.a < 0.1) { discard; }
        
        let albedo = albedoMap.rgb * material.baseColor.rgb;
        let dummyMRAO = textureSample(texMRAO, samp, in.uv).rgb * 0.001; // Keep binding alive!
        let dummyNormal = textureSample(texNormal, samp, in.uv).rgb * 0.0;
        
        // ARTSY RIM GLOW (Fresnel)
        let NdotV = max(dot(normalize(in.worldNormal), normalize(in.viewDir)), 0.0);
        
        // rimIntensity controls the "thinness" of the glow on the wing edges. 
        // 2.5 is a nice magical dropoff.
        let rimIntensity = pow(1.0 - NdotV, 2.5); 
        
        // Multiply the base instance color by the rim effect
        let enhancedGlow = in.glowColor + (in.glowColor * rimIntensity * 3.0);
        
        // RANDOM PULSE
        // Use the seed from the vertex shader so each butterfly dims/brightens independently
        let pulseSpeed = 4.0;
        let pulse = (sin(camera.simTime * pulseSpeed + in.seed * 20.0) * 0.4 + 0.6);
        
        let finalColor = (albedo + dummyMRAO) * enhancedGlow * pulse; 
        
        return vec4<f32>(finalColor, 0.1); 
    }
`;