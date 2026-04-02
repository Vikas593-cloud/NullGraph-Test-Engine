export const stellarComputeShader = `
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

        let time = camera.simTime;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // --- MAGNETIC REACTOR TOPOLOGY ---
        let majorRadius = 80.0;
        let baseMinorRadius = 30.0;

        // 1. Find the nearest point on the central Torus ring
        let posXZ = vec2<f32>(pos.x, pos.z);
        let dirXZ = normalize(posXZ);
        let ringPos = vec3<f32>(dirXZ.x * majorRadius, 0.0, dirXZ.y * majorRadius);

        // 2. Vector from the ring core to the particle
        let toParticle = pos - ringPos;
        let distToRing = max(length(toParticle), 0.1); // Avoid div by zero
        let normToParticle = toParticle / distToRing;

        // 3. Plasma Pinch Instability (Breathing effect along the ring)
        let toroidalAngle = atan2(pos.z, pos.x);
        let pinch = sin(toroidalAngle * 8.0 - time * 4.0) * 8.0;
        let dynamicMinorRadius = baseMinorRadius + pinch;

        // --- FORCES ---
        
        // A: Confinement Force (Pulls plasma into the tube shape)
        let confinementForce = -normToParticle * (distToRing - dynamicMinorRadius) * 15.0;

        // B: Poloidal Field (Spiraling around the cross-section)
        let tangentXZ = vec3<f32>(dirXZ.x, 0.0, dirXZ.y);
        let poloidalDir = cross(normToParticle, tangentXZ);
        let poloidalForce = poloidalDir * 65.0;

        // C: Toroidal Field (Spinning around the main Y axis)
        let toroidalDir = vec3<f32>(-dirXZ.y, 0.0, dirXZ.x);
        let toroidalForce = toroidalDir * 120.0;

        // D: Micro-Turbulence (Heat simulation via basic trig noise)
        let t = time * 2.0;
        let turbulence = vec3<f32>(
            sin(pos.y * 0.1 + t),
            cos(pos.z * 0.1 - t),
            sin(pos.x * 0.1 + t)
        ) * 20.0;

        // --- INTERACTIVE ANOMALY (Mouse) ---
        // Mouse acts as a magnetic singularity that breaks containment
        let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
        let mouseDir = pos - mouseWorld;
        let mouseDist = length(mouseDir);
        let anomalyForce = normalize(mouseDir) * (150000.0 / (mouseDist * mouseDist + 10.0));

        // Combine Forces
        var force = confinementForce + poloidalForce + toroidalForce + turbulence;
        
        // Let the mouse rip particles out of the magnetic field
        if (mouseDist < 60.0) {
            force += anomalyForce;
        }

        // --- INTEGRATE ---
        let dt = 0.016; 
        vel += force * dt;
        
        // Speed limits
        let speedLimit = 220.0;
        let speed = length(vel);
        if (speed > speedLimit) {
            vel = (vel / speed) * speedLimit;
        }
        
        vel *= 0.96; // Magnetic drag / damping
        pos += vel * dt;

        // --- THERMAL COLOR MAPPING ---
        // Map color based on how close the particle is to the magnetic core
        let heat = clamp(1.0 - (distToRing / (dynamicMinorRadius * 1.5)), 0.0, 1.0);
        
        let edgeColor = vec3<f32>(0.5, 0.0, 1.0);  // Deep Purple
        let midColor  = vec3<f32>(0.0, 0.8, 1.0);  // Neon Cyan
        let coreColor = vec3<f32>(1.0, 0.9, 1.0);  // Superhot White-Pink

        var finalColor = mix(edgeColor, midColor, smoothstep(0.1, 0.6, heat));
        finalColor = mix(finalColor, coreColor, smoothstep(0.6, 1.0, heat));

        // Velocity sparks (fast particles flash orange/gold)
        finalColor += vec3<f32>(1.0, 0.4, 0.0) * smoothstep(150.0, 220.0, speed);

        // WRITE
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
        renderData[wBase + 11u] = max(finalColor.r, 0.0); 
        renderData[wBase + 12u] = max(finalColor.g, 0.0); 
        renderData[wBase + 13u] = max(finalColor.b, 0.0);
    }
`;

export const stellarRenderShader = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>,
        @location(1) dist: f32, 
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); 
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        let speed = length(vel);
        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);
        
        var right = cross(worldUp, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);
        
        // Stretch the particles radically based on speed to look like light streaks
        let scaleVec = vec3<f32>(0.15, 0.15, 0.5 + speed * 0.12);
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Boost color for the Uncharted 2 Tonemapper in the post-pass
        out.color = baseColor * 2.5; 
        out.dist = screenPos.w; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>, @location(1) dist: f32) -> @location(0) vec4<f32> {
        let depthAlpha = clamp(1.0 - (dist / 450.0), 0.0, 1.0);
        return vec4<f32>(color, depthAlpha); 
    }
`;