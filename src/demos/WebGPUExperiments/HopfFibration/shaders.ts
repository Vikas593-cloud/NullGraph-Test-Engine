export const hopfComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> mathState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 150000u) { return; } 

        let time = camera.simTime;
        let base = idx * 14u;

        // Read parametric angles
        let eta = mathState[base + 1u];
        var xi1 = mathState[base + 2u];
        var xi2 = mathState[base + 3u];

        // 1. FLOW: Move along the fibers
        // xi1 and xi2 dictate where on the ring the point is. Incrementing them makes the torus "spin" inside out.
        let speed = 0.5;
        xi1 += 0.016 * speed * 2.0;
        xi2 += 0.016 * speed * 1.5;
        
        // Save angles back
        mathState[base + 2u] = xi1;
        mathState[base + 3u] = xi2;

        // 2. MAP TO 4D HYPERSPHERE (x, y, z, w)
        var p4 = vec4<f32>(
            sin(eta) * cos(xi1),
            sin(eta) * sin(xi1),
            cos(eta) * cos(xi2),
            cos(eta) * sin(xi2)
        );

        // 3. 4D ROTATION (Clifford Translation via Mouse)
        // We rotate the XW plane and the YZ plane simultaneously
        let rotAngle1 = camera.eye.x * 2.0 + time * 0.2; // Hijacked mouse X
        let rotAngle2 = camera.eye.y * 2.0 - time * 0.1; // Hijacked mouse Y
        
        let c1 = cos(rotAngle1); let s1 = sin(rotAngle1);
        let c2 = cos(rotAngle2); let s2 = sin(rotAngle2);

        // Apply rotation
        let x_new = p4.x * c1 - p4.w * s1;
        let w_new = p4.x * s1 + p4.w * c1;
        let y_new = p4.y * c2 - p4.z * s2;
        let z_new = p4.y * s2 + p4.z * c2;
        p4 = vec4<f32>(x_new, y_new, z_new, w_new);

        // 4. STEREOGRAPHIC PROJECTION TO 3D
        // Maps the 4D surface into our 3D space. 
        // We use (1.2 - p4.w) to prevent division by zero (infinity) when p4.w = 1
        let scale = 18.0 / (1.2 - p4.w); 
        let pos3D = vec3<f32>(p4.x, p4.y, p4.z) * scale;

        // Read previous position to calculate delta/velocity for the vertex stretcher
        let prevPos = vec3<f32>(mathState[base + 4u], mathState[base + 5u], mathState[base + 6u]);
        
        // Save current pos as previous for next frame
        mathState[base + 4u] = pos3D.x; 
        mathState[base + 5u] = pos3D.y; 
        mathState[base + 6u] = pos3D.z;

        // 5. COLOR MAPPING (Based on Topology, not physical speed)
        // 'eta' dictates which torus shell the particle is on.
        let pi = 3.14159;
        let normalizedEta = eta / (pi / 2.0); // 0.0 to 1.0
        
        // Smooth spectral math mapping
        let colorVec = vec3<f32>(
            sin(normalizedEta * pi * 2.0 + 0.0) * 0.5 + 0.5,
            sin(normalizedEta * pi * 2.0 + 2.0) * 0.5 + 0.5,
            sin(normalizedEta * pi * 2.0 + 4.0) * 0.5 + 0.5
        );
        
        // Boost intensity when particles get close to the "core" (w approaches 1)
        let intensity = pow(scale / 18.0, 2.0);
        let finalColor = colorVec * intensity * 1.5;

        // 6. WRITE OUT FOR RENDERER
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        // Render Data: 1-3 (Pos), 4-6 (PrevPos for stretching), 11-13 (Color)
        renderData[wBase + 1u] = pos3D.x; renderData[wBase + 2u] = pos3D.y; renderData[wBase + 3u] = pos3D.z;
        renderData[wBase + 4u] = prevPos.x; renderData[wBase + 5u] = prevPos.y; renderData[wBase + 6u] = prevPos.z;
        renderData[wBase + 11u] = finalColor.r; renderData[wBase + 12u] = finalColor.g; renderData[wBase + 13u] = finalColor.b;
    }
`;

export const hopfRenderShader = `
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
        let prevPos = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); 
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Calculate flow direction from previous frame
        var delta = pos - prevPos;
        
        // Handle the first frame or teleportation wrap-arounds
        if (length(delta) > 5.0 || length(delta) < 0.001) {
            delta = vec3<f32>(0.001, 0.0, 0.0);
        }

        let forward = normalize(delta);
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);
        
        var right = cross(worldUp, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let up = cross(forward, right);
        
        let rotMat = mat3x3<f32>(right, up, forward);
        
        // Stretch dramatically along the topological flow
        let scaleVec = vec3<f32>(0.08, 0.08, length(delta) * 1.5);
        let orientedPos = rotMat * (localPos * scaleVec);

        let screenPos = camera.viewProj * vec4<f32>(orientedPos + pos, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Make the colors incredibly bright to feed the anamorphic threshold
        out.color = baseColor * 3.0; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;