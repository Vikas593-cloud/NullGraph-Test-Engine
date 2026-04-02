export const leviathanComputeShader = `
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

        let time = camera.simTime * 0.5;
        let base = idx * 14u;
        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // 1. INCOMPRESSIBLE CURL NOISE (Fluid flow)
        let scale1 = 0.05; let scale2 = 0.1;
        
        // Compute pseudo-pressure gradients
        let cx = sin(pos.y * scale1 + time) + cos(pos.z * scale2 - time);
        let cy = sin(pos.z * scale1 + time) + cos(pos.x * scale2 + time);
        let cz = sin(pos.x * scale1 - time) + cos(pos.y * scale2 + time);
        
        let fluidForce = vec3<f32>(cx, cy, cz) * 25.0;

        // 2. MOUSE SWIRL
        let mouseWorld = vec3<f32>(camera.eye.x * 100.0, camera.eye.y * 100.0, 0.0);
        let dirToMouse = pos - mouseWorld;
        let distToMouse = length(dirToMouse);
        
        var mouseForce = vec3<f32>(0.0);
        if (distToMouse < 60.0) {
            // Create a vortex around the mouse rather than just pulling/pushing
            let vortex = cross(normalize(dirToMouse), vec3<f32>(0.0, 1.0, 0.0));
            mouseForce = vortex * (60.0 - distToMouse) * 1.5;
        }

        // 3. ABSOLUTE CONTAINMENT (Fixing the "disappearing" issue)
        var boundsForce = vec3<f32>(0.0);
        let distFromCenter = length(pos);
        if (distFromCenter > 80.0) {
            // Aggressive rubber-band snap back to center
            boundsForce = -normalize(pos) * (distFromCenter - 80.0) * 10.0;
        }

        // 4. INTEGRATE
        let dt = 0.016; 
        vel += (fluidForce + mouseForce + boundsForce) * dt;
        
        let speedLimit = 80.0;
        if (length(vel) > speedLimit) { vel = normalize(vel) * speedLimit; }
        
        vel *= 0.95; // Viscous friction
        pos += vel * dt;

        // 5. WRITE STATE (We don't need color anymore, the post-process handles it)
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
    }
`;

export const leviathanRenderShader = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);

        // Perfect Billboarding: Extract camera axes
        let right = vec3<f32>(camera.viewProj[0][0], camera.viewProj[1][0], camera.viewProj[2][0]);
        let up = vec3<f32>(camera.viewProj[0][1], camera.viewProj[1][1], camera.viewProj[2][1]);
        
        let particleRadius = 1.2; 
        let worldPosition = pos + right * localPos.x * particleRadius + up * localPos.y * particleRadius;

        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        // Pass the raw local coordinates to the fragment shader to calculate the curve
        out.uv = localPos.xy; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        // uv is roughly from -1 to 1 based on geometry bounds
        let distSq = dot(uv, uv);
        
        // Discard pixels outside the radius to make perfect circles out of whatever geometry was passed
        if (distSq > 1.0) { discard; }
        
        // Calculate the Z-height of a perfect sphere mathematically
        let z = sqrt(1.0 - distSq);
        
        // The Normal vector pointing towards the camera
        let normal = vec3<f32>(uv.x, uv.y, z);
        
        // Encode normal from [-1, 1] to [0, 1] for safe storage in the texture
        let encodedNormal = normal * 0.5 + vec3<f32>(0.5);
        
        // Alpha = 1.0 tells the post-processor "this is a particle"
        return vec4<f32>(encodedNormal, 1.0); 
    }
`;