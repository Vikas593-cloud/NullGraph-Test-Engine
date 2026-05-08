export const epicComputeShader = `
    struct IndirectDrawArgs {
        indexCount: u32,
        instanceCount: atomic<u32>, 
        firstIndex: u32,
        baseVertex: u32,
        firstInstance: u32,
    };

    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 8000u) { return; } 

        let time = camera.simTime;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        let dir = -pos; 
        let dist = max(length(dir), 1.0);
        let normDir = dir / dist;
        
        // Slightly weaker gravity so they don't clump as fast
        let gravityStrength = 12000.0 / (dist * dist + 150.0);
        var force = normDir * gravityStrength;

        var swirl = cross(normDir, vec3<f32>(0.0, 1.0, 0.0));
        if (length(swirl) < 0.001) { swirl = vec3<f32>(1.0, 0.0, 0.0); }
        // Stronger swirl to keep them orbiting!
        force += normalize(swirl) * (gravityStrength * 2.5);

        let noiseScale = 0.05; // Smoother turbulence
        let nx = sin(pos.y * noiseScale + time) + cos(pos.z * noiseScale);
        let ny = sin(pos.z * noiseScale + time) + cos(pos.x * noiseScale);
        let nz = sin(pos.x * noiseScale + time) + cos(pos.y * noiseScale);
        force += vec3<f32>(nx, ny, nz) * 12.0;

        if (dist < 15.0) {
            let pole = sign(pos.y + 0.001);
            force += vec3<f32>(0.0, pole * 3000.0, 0.0);
            vel = vec3<f32>(0.0); 
        }

        let dt = 0.016; 
        vel += force * dt;
        vel *= 0.985; // Less drag, more sliding!
        pos += vel * dt;

        // --- NEW NEBULA COLOR MATH ---
        // Much wider spread (40 to 400) so the outer edge gets effects too
        let heat = 1.0 - smoothstep(40.0, 400.0, dist);
        
        // Random noise per particle so they aren't totally uniform
        let colorNoise = fract(sin(f32(idx) * 12.9898) * 43758.5453); 

        let edgeColor = vec3<f32>(0.02, 0.0, 0.15);    // Very dark void purple
        let midColor = vec3<f32>(0.6, 0.1, 0.8);       // Bright Magenta
        let hotColor = vec3<f32>(0.1, 0.8, 1.0);       // Cyan
        let coreColor = vec3<f32>(2.0, 2.0, 2.0);      // Blinding white
        
        var finalColor = mix(edgeColor, midColor, smoothstep(0.0, 0.4, heat + (colorNoise * 0.1)));
        finalColor = mix(finalColor, hotColor, smoothstep(0.4, 0.8, heat));
        finalColor = mix(finalColor, coreColor, smoothstep(0.8, 1.0, heat));

        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;
        
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        for(var i = 0u; i < 14u; i = i + 1u) {
            renderData[wBase + i] = physicsState[base + i];
        }
        
        renderData[wBase + 11u] = finalColor.r; 
        renderData[wBase + 12u] = finalColor.g; 
        renderData[wBase + 13u] = finalColor.b;
    }
`;

export const epicRenderShader = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) localPos: vec3<f32>,   
        @location(1) normal: vec3<f32>,      
        @location(2) uv: vec2<f32>,
        @builtin(instance_index) iIdx: u32
    ) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); 
        let heatColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        let forward = normalize(vel + vec3<f32>(0.001, 0.0, 0.0));
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);
        var right = cross(worldUp, forward);
        if (length(right) < 0.01) { right = vec3<f32>(1.0, 0.0, 0.0); }
        right = normalize(right);
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);

        // --- MASSIVE SCALE REDUCTION ---
        let scale = 0.9; 
        let rotatedPos = rotMat * (localPos * scale);
        let rotatedNorm = normalize(rotMat * normal);

        let worldPosition = rotatedPos + pos;

        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        let lightDir = normalize(-worldPosition); 
        let diffuse = max(dot(rotatedNorm, lightDir), 0.0);
        
        // Boosted ambient so the blue/purple outer ones are clearly visible
        let ambient = 0.4;
        let lighting = ambient + (diffuse * 0.8);
        
        // Multiplier helps the post-process God Rays explode
        out.color = heatColor * lighting * 3.5; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;