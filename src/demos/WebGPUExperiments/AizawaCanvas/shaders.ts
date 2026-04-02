export const aizawaComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    // Pseudo-random noise for ribbon thickness
    fn hash3(p: vec3<f32>) -> vec3<f32> {
        var q = vec3<f32>(
            dot(p, vec3<f32>(127.1, 311.7, 74.7)),
            dot(p, vec3<f32>(269.5, 183.3, 246.1)),
            dot(p, vec3<f32>(113.5, 271.9, 124.6))
        );
        return fract(sin(q) * 43758.5453123) * 2.0 - 1.0;
    }

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 150000u) { return; } 

        let base = idx * 14u;
        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // 1. AIZAWA ATTRACTOR MATH
        let a = 0.95; let b = 0.7; let c = 0.6; let d = 3.5; let e = 0.25; let f = 0.1;
        
        // Scale down position to keep the math stable
        let p = pos * 0.3; 
        
        let dx = (p.z - b) * p.x - d * p.y;
        let dy = d * p.x + (p.z - b) * p.y;
        let dz = c + a * p.z - (p.z * p.z * p.z)/3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * p.x * p.x * p.x;
        
        // Scale force back up for WebGPU coordinate space
        var force = vec3<f32>(dx, dy, dz) * 12.0;

        // Add micro-noise so particles don't overlap perfectly (makes the ribbons thick)
        force += hash3(pos * 5.0) * 8.0;

        // 2. MOUSE VISCOSITY FIELD
        let mouseWorld = vec3<f32>(camera.eye.x * 50.0, camera.eye.y * 50.0, 10.0);
        let distToMouse = length(pos - mouseWorld);
        
        // If close to the mouse, massively increase friction (viscosity)
        var friction = 0.96; 
        if (distToMouse < 25.0) {
            friction = 0.70; // Thick sludge
        }

        // 3. INTEGRATION
        let dt = 0.016; 
        vel += force * dt;
        vel *= friction; 
        pos += vel * dt;

        // 4. NEON ACRYLIC COLORS
        let speed = length(vel);
        let posNorm = normalize(pos);
        
        // Map color to spatial height and velocity to get a "layered paint" look
        let colA = vec3<f32>(0.0, 1.0, 0.8); // Cyan
        let colB = vec3<f32>(1.0, 0.8, 0.0); // Gold
        let colC = vec3<f32>(1.0, 0.0, 0.5); // Magenta
        
        var finalColor = mix(colA, colB, smoothstep(-15.0, 15.0, pos.y));
        finalColor = mix(finalColor, colC, smoothstep(15.0, 40.0, speed));

        // 5. WRITE
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

export const aizawaRenderShader = `
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

        // Billboarding (always face camera) to create dense, flat circles
        // This is ideal for the Kuwahara filter to blend together
        let speed = length(vel);
        let scale = 0.45; 
        
        // Extract camera right and up vectors from viewProj (approximation for billboarding)
        let right = vec3<f32>(camera.viewProj[0][0], camera.viewProj[1][0], camera.viewProj[2][0]);
        let up = vec3<f32>(camera.viewProj[0][1], camera.viewProj[1][1], camera.viewProj[2][1]);
        
        let worldPosition = pos + right * localPos.x * scale + up * localPos.y * scale;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Boost color intensity to ensure vivid paint strokes
        out.color = baseColor * 1.5; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;