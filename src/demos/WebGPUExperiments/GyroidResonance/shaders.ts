export const gyroidComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 150000u) { return; } 

        let time = camera.simTime * 0.4;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // 1. DYNAMIC GYROID LATTICE (Triply Periodic Minimal Surface)
        let scale = 0.12; 
        let p = pos * scale;
        
        // Analytical Gradient of sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x)
        // Shifting phase with 'time' makes the lattice continuously fold inside out
        let t1 = p.x + time; let t2 = p.y - time*0.5; let t3 = p.z + time*0.8;
        
        let dx = cos(t1)*cos(t2) - sin(t3)*sin(t1);
        let dy = cos(t2)*cos(t3) - sin(t1)*sin(t2);
        let dz = cos(t3)*cos(t1) - sin(t2)*sin(t3);
        
        // Push particles into the structural valleys
        let gyroidForce = vec3<f32>(dx, dy, dz) * 60.0;

        // 2. MAGNETIC SWIRL (Curl Noise applied to the lattice)
        let curlForce = cross(gyroidForce, normalize(pos + vec3<f32>(0.1))) * 0.5;

        // 3. THE MOUSE "FRACTURE" SHOCKWAVE
        let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
        let mouseDir = pos - mouseWorld; 
        let mouseDistSq = dot(mouseDir, mouseDir);
        
        // Extremely localized, extremely violent anti-gravity explosion
        let fractureForce = normalize(mouseDir) * (500000.0 / (mouseDistSq + 100.0));

        // 4. SPHERICAL CONTAINMENT
        let dist = length(pos);
        var boundsForce = vec3<f32>(0.0);
        if (dist > 140.0) {
            boundsForce = -normalize(pos) * pow(dist - 140.0, 1.5) * 2.0; 
        }

        // 5. INTEGRATION
        let totalForce = gyroidForce + curlForce + fractureForce + boundsForce;
        let dt = 0.016; 
        vel += totalForce * dt;
        
        let speedLimit = 120.0;
        if (length(vel) > speedLimit) { vel = normalize(vel) * speedLimit; }
        
        vel *= 0.92; // Friction helps them settle into the lattice
        pos += vel * dt;

        // 6. COLOR ASSIGNMENT (Energy-based mapping)
        let speed = length(vel);
        let coreColor = vec3<f32>(0.0, 0.8, 1.0);     // Cyan Base
        let exciteColor = vec3<f32>(1.0, 0.2, 0.5);   // Hot Pink for high velocity
        let fractureColor = vec3<f32>(3.0, 2.0, 0.5); // Blinding gold near mouse
        
        var finalColor = mix(coreColor, exciteColor, smoothstep(5.0, 40.0, speed));
        
        // Spike the color intensity if affected by the mouse
        let mouseInfluence = smoothstep(1500.0, 0.0, mouseDistSq);
        finalColor = mix(finalColor, fractureColor, mouseInfluence);

        // 7. WRITE TO BUFFER
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

export const gyroidRenderShader = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>,
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); 
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Velocity alignment math
        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        var right = cross(vec3<f32>(0.0, 1.0, 0.0), forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);
        
        // Stretch into shards based on velocity
        let speed = length(vel);
        let scaleVec = vec3<f32>(0.2, 0.2, 0.4 + speed * 0.08);
        
        let worldPosition = rotMat * (localPos * scaleVec) + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Fade out into the distance
        let depthFade = clamp(1.0 - (screenPos.w / 350.0), 0.0, 1.0);
        out.color = baseColor * depthFade; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;