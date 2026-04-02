// demos/WebGPUExperiments/LabyrinthChaos/shaders.ts

export const labyrinthComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { 
        viewProj: mat4x4<f32>, 
        customData: vec4<f32> // x = mouseX, y = mouseY, z = isMouseDown, w = simTime
    };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 200000u) { return; } 

        let time = camera.customData.w * 0.5;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // 1. THOMAS CYCLICALLY SYMMETRIC ATTRACTOR (1999)
        // Equation: dx/dt = sin(y) - bx, dy/dt = sin(z) - by, dz/dt = sin(x) - bz
        // Creates an infinite lattice of fractional-dimension chaotic pathways.
        let scale = 0.25; 
        let p = pos * scale;
        
        // The dissipation constant 'b'. Values < 0.208186 create the labyrinth.
        // We dynamically warp this constant based on time and mouse interaction to make the lattice "breathe".
        let b = 0.19 + (sin(time * 0.5) * 0.015) - (camera.customData.z * 0.1);
        
        let dx = sin(p.y) - b * p.x;
        let dy = sin(p.z) - b * p.y;
        let dz = sin(p.x) - b * p.z;
        
        // Amplify the vector field into a physical force
        let labyrinthForce = vec3<f32>(dx, dy, dz) * 120.0;

        // 2. MACROSCOPIC GRAVITY & CONTAINMENT
        // Prevents them from flying out of the visually pleasing zone
        let dist = length(pos);
        var containmentForce = vec3<f32>(0.0);
        if (dist > 150.0) {
            containmentForce = -normalize(pos) * (dist - 150.0) * 5.0; 
        }

        // 3. SINGULARITY RUPTURE (Mouse Interaction)
        // Clicking tears the labyrinth fabric, acting as a massive gravity well
        let mouseWorld = vec3<f32>(camera.customData.x * 2.0, camera.customData.y * 2.0, 0.0);
        let dirToMouse = mouseWorld - pos;
        let distToMouseSq = dot(dirToMouse, dirToMouse);
        let ruptureForce = normalize(dirToMouse) * (200000.0 / (distToMouseSq + 10.0)) * camera.customData.z;

        // 4. INTEGRATION
        let totalForce = labyrinthForce + containmentForce + ruptureForce;
        let dt = 0.016; 
        vel += totalForce * dt;
        
        let speedLimit = 150.0;
        if (length(vel) > speedLimit) { vel = normalize(vel) * speedLimit; }
        
        vel *= 0.95; // Slight friction
        pos += vel * dt;

        // 5. QUANTUM FLUORESCENCE (Color mapped to spatial derivative)
        // Colors shift based on which axis is experiencing the most "acceleration" in the lattice
        let speed = length(vel);
        let accelBias = normalize(abs(vec3<f32>(dx, dy, dz)));
        
        // Base Colors: Deep Cherenkov Blue, Neon Magenta, and Atomic Gold
        let cX = vec3<f32>(0.0, 0.5, 1.0) * accelBias.x; // Blue
        let cY = vec3<f32>(1.0, 0.0, 0.5) * accelBias.y; // Magenta
        let cZ = vec3<f32>(1.0, 0.8, 0.0) * accelBias.z; // Gold
        
        var finalColor = (cX + cY + cZ) * 2.0;
        
        // Flash bright white/cyan at high speeds
        let flash = smoothstep(60.0, 150.0, speed);
        finalColor = mix(finalColor, vec3<f32>(2.0, 3.0, 4.0), flash);

        // 6. WRITE TO BUFFER
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

export const labyrinthRenderShader = `
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

        // Billboard and stretch along velocity vector
        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        var right = cross(vec3<f32>(0.0, 1.0, 0.0), forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);
        
        let speed = length(vel);
        // Make them incredibly thin but long, like photon traces
        let scaleVec = vec3<f32>(0.05, 0.05, 0.8 + speed * 0.15);
        
        let worldPosition = rotMat * (localPos * scaleVec) + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Distance fog / depth fade
        let depthFade = clamp(1.0 - (screenPos.w / 450.0), 0.0, 1.0);
        out.color = baseColor * depthFade * 1.5; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;