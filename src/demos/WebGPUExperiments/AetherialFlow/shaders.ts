export const aetherComputeShader = `
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

        // 1. MACRO FORCE (Lorenz)
        let sigma = 10.0; let rho = 28.0; let beta = 8.0 / 3.0;
        let lp = pos * 0.1; 
        let lorenzForce = vec3<f32>(
            sigma * (lp.y - lp.x),
            lp.x * (rho - lp.z) - lp.y,
            lp.x * lp.y - beta * lp.z
        );

        // 2. MICRO FORCE (Fluid)
        let noiseScale = 0.05; let t = time * 0.5;
        let p0 = pos * noiseScale + vec3<f32>(t, -t, t*0.5);
        let p1 = pos * noiseScale - vec3<f32>(-t, t, -t*0.5);
        let fluidForce = vec3<f32>(cos(p0.y) + sin(p1.z), cos(p0.z) + sin(p1.x), cos(p0.x) + sin(p1.y)) * 40.0;

        // --- NEW: 3. INTERACTIVE MOUSE GRAVITY ---
        // Decode the hijacked mouse coordinates
        // Multiply by 150 so the mouse maps to the full width of the 3D space
        let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
        let mouseDir = mouseWorld - pos;
        let mouseDist = max(length(mouseDir), 1.0);
        
        // Inverse-square law: Pulls incredibly hard when close, weak when far
        let mouseForce = normalize(mouseDir) * (20000.0 / (mouseDist * mouseDist + 50.0));

        // --- NEW: 4. THE LEASH (Center Gravity & Bounds) ---
        let dist = length(pos);
        var boundsForce = vec3<f32>(0.0);
        
        // If they get further than 160 units away, aggressively snap them back
        if (dist > 160.0) {
            boundsForce = -normalize(pos) * (dist - 160.0) * 15.0; 
        }
        
        // A very gentle, constant pull to the dead center (0,0,0) to prevent the whole cloud from drifting
        let centerGravity = -normalize(pos) * dist * 0.5;

        // COMBINE ALL FORCES (Notice Lorenz is dialed back slightly to let the mouse overpower it)
        var force = (lorenzForce * 0.35) + fluidForce + boundsForce + mouseForce + centerGravity;

        // 5. INTEGRATE
        let dt = 0.016; 
        vel += force * dt;
        
        // Speed limit
        let speedLimit = 150.0;
        if (length(vel) > speedLimit) {
            vel = normalize(vel) * speedLimit;
        }
        
        vel *= 0.94; 
        pos += vel * dt;

        // 6. COLOR
        let speed = length(vel);
        let curveColor = vec3<f32>(0.0, 1.0, 0.7); 
        let fastColor = vec3<f32>(1.0, 0.0, 0.8);  
        var finalColor = mix(curveColor, fastColor, smoothstep(10.0, 50.0, speed));
        finalColor += vec3<f32>(0.2, 0.2, 0.5) * sin(pos.y * 0.1 + time); 

        // 7. WRITE
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

export const aetherRenderShader = `
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

        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);
        
        // Failsafe Cross Product: Prevents NaN if moving straight up
        var right = cross(worldUp, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);
        
        let speed = length(vel);
        let scaleVec = vec3<f32>(0.3, 0.3, 0.5 + speed * 0.05);
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        out.color = baseColor * 1.5; 
        out.dist = screenPos.w; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>, @location(1) dist: f32) -> @location(0) vec4<f32> {
        let depthAlpha = clamp(1.0 - (dist / 400.0), 0.0, 1.0);
        return vec4<f32>(color, depthAlpha); 
    }
`;