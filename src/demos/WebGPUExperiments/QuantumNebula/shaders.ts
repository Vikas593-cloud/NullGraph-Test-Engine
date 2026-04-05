export const nebulaComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 200000u) { return; } 

        let time = camera.simTime;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        let dist = length(pos);
        let dir = normalize(pos);

        // 1. GALAXY SWIRL (Perpendicular force to create orbit)
        let up = vec3<f32>(0.0, 1.0, 0.0);
        let orbitDir = cross(up, dir);
        let orbitForce = orbitDir * 150.0;

        // 2. BLACK HOLE GRAVITY (Pulls inwards, stronger when closer)
        var gravityForce = -dir * (8000.0 / (dist + 10.0));

        // 3. EVENT HORIZON REPULSION (Shoots them up/down out of the poles if they get too close)
        var jetForce = vec3<f32>(0.0);
        if (dist < 20.0) {
            let poleDir = sign(pos.y + 0.001); // Up or down
            jetForce = vec3<f32>(0.0, poleDir * 300.0, 0.0);
            gravityForce *= 0.1; // Weakened gravity at the core so they can escape
        }

        // 4. TURBULENCE (Noise)
        let noise = vec3<f32>(sin(pos.y * 0.1 + time), cos(pos.z * 0.1), sin(pos.x * 0.1 - time)) * 20.0;

        // Apply Forces
        let force = orbitForce + gravityForce + jetForce + noise;
        
        let dt = 0.016; 
        vel += force * dt;
        
        // Friction and Speed Limit
        vel *= 0.96; 
        if (length(vel) > 200.0) {
            vel = normalize(vel) * 200.0;
        }
        
        pos += vel * dt;

        // 5. COLOR BASED ON ENERGY (Distance + Speed)
        let speed = length(vel);
        
        // Deep purple/blue on the outside, searing cyan/white on the inside
        let coreColor = vec3<f32>(0.1, 0.8, 1.0);
        let edgeColor = vec3<f32>(0.4, 0.0, 0.8);
        
        var finalColor = mix(coreColor, edgeColor, smoothstep(10.0, 150.0, dist));
        
        // Flash bright white if moving super fast (caught in the polar jets)
        finalColor = mix(finalColor, vec3<f32>(1.0, 0.9, 1.0), smoothstep(100.0, 180.0, speed));

        // Scale color down drastically because ADDITIVE BLENDING will multiply the brightness quickly
        finalColor *= 0.15;

        // Write Back
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
        renderData[wBase + 11u] = finalColor.r; 
        renderData[wBase + 12u] = finalColor.g; 
        renderData[wBase + 13u] = finalColor.b;
    }
`;

export const nebulaRenderShader = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); 
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Stretch cubes along their velocity vector to look like light streaks
        let forward = normalize(vel + vec3<f32>(0.001, 0.0, 0.0));
        let up = vec3<f32>(0.0, 1.0, 0.0);
        var right = cross(up, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let realUp = cross(forward, right);
        
        let rotMat = mat3x3<f32>(right, realUp, forward);
        
        let speed = length(vel);
        // Base size 0.2, stretches up to 4.0 units based on speed
        let scaleVec = vec3<f32>(0.2, 0.2, 0.1 + (speed * 0.02)); 
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;
        
        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        // Fade out slightly in the distance to give depth perception back (since depth sorting is off)
        let depthFade = clamp(1.0 - (out.pos.w / 500.0), 0.1, 1.0);
        out.color = baseColor * depthFade; 
        
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        // Output with an alpha of 1.0, the blend state handles the math!
        return vec4<f32>(color, 1.0); 
    }
`;