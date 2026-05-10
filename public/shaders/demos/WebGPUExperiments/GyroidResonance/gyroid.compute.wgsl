 struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };

    // --- NEW: COLOR PARAMS STRUCT ---
    struct GyroidParams {
        coreColor: vec3<f32>,
        _pad1: f32, // WGSL requires vec3 to align to 16 bytes (4 floats)
        exciteColor: vec3<f32>,
        _pad2: f32,
        fractureColor: vec3<f32>,
        _pad3: f32,
    };

    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    // --- NEW: BIND THE PARAMS ---
    @group(1) @binding(0) var<uniform> params: GyroidParams;

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 150000u) { return; }

        let time = camera.simTime * 0.4;
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        let scale = 0.12;
        let p = pos * scale;

        let t1 = p.x + time; let t2 = p.y - time*0.5; let t3 = p.z + time*0.8;

        let dx = cos(t1)*cos(t2) - sin(t3)*sin(t1);
        let dy = cos(t2)*cos(t3) - sin(t1)*sin(t2);
        let dz = cos(t3)*cos(t1) - sin(t2)*sin(t3);

        let gyroidForce = vec3<f32>(dx, dy, dz) * 60.0;
        let curlForce = cross(gyroidForce, normalize(pos + vec3<f32>(0.1))) * 0.5;

        let mouseWorld = vec3<f32>(camera.eye.x * 150.0, camera.eye.y * 150.0, 0.0);
        let mouseDir = pos - mouseWorld;
        let mouseDistSq = dot(mouseDir, mouseDir);

        let fractureForce = normalize(mouseDir) * (500000.0 / (mouseDistSq + 100.0));

        let dist = length(pos);
        var boundsForce = vec3<f32>(0.0);
        if (dist > 140.0) {
            boundsForce = -normalize(pos) * pow(dist - 140.0, 1.5) * 2.0;
        }

        let totalForce = gyroidForce + curlForce + fractureForce + boundsForce;
        let dt = 0.016;
        vel += totalForce * dt;

        let speedLimit = 120.0;
        if (length(vel) > speedLimit) { vel = normalize(vel) * speedLimit; }

        vel *= 0.92;
        pos += vel * dt;

        // --- NEW: USE THE DYNAMIC COLORS ---
        let speed = length(vel);

        var finalColor = mix(params.coreColor, params.exciteColor, smoothstep(5.0, 40.0, speed));

        let mouseInfluence = smoothstep(1500.0, 0.0, mouseDistSq);
        finalColor = mix(finalColor, params.fractureColor, mouseInfluence);

        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;

        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
        renderData[wBase + 11u] = finalColor.r;
        renderData[wBase + 12u] = finalColor.g;
        renderData[wBase + 13u] = finalColor.b;
    }