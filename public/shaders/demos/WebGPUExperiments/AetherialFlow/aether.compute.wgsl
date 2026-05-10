struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };

    struct AetherParams {
        curveColor: vec3<f32>,
        _pad1: f32,
        fastColor: vec3<f32>,
        _pad2: f32,
        pulseColor: vec3<f32>,
        _pad3: f32,
    };

    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    @group(1) @binding(0) var<uniform> aether: AetherParams;

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
        var finalColor = mix(aether.curveColor, aether.fastColor, smoothstep(10.0, 50.0, speed));
        finalColor += aether.pulseColor * sin(pos.y * 0.1 + time);

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