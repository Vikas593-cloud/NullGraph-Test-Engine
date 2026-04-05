export const cymaticComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    // A simple pseudo-random number generator for WebGPU
    fn hash(state: ptr<function, u32>) -> f32 {
        var x = *state;
        x = x ^ (x << 13u); x = x ^ (x >> 17u); x = x ^ (x << 5u);
        *state = x;
        return f32(x) / 4294967296.0;
    }

   @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 100000u) { return; } 

        let time = camera.simTime;
        let base = idx * 14u;
        var prngState = idx + u32(time * 1000.0);

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        let dt = 0.016; 
        
        // 1. KINEMATICS (Gravity)
        vel.y -= 9.8 * 2.0 * dt; 

        // 2. THE CHLADNI WAVE FUNCTION
        // Frequencies slowly shift over time, forcing the sand to reorganize into new patterns
        let pi = 3.14159265;
        let n = 3.0 + floor(sin(time * 0.2) * 2.0); // Modulates between 1, 3, 5
        let m = 4.0 + floor(cos(time * 0.15) * 2.0); // Modulates between 2, 4, 6
        
        // Normalize coordinates to the size of the plate (-1 to 1)
        let nx = pos.x / 50.0;
        let nz = pos.z / 50.0;

        // The exact mathematical formula Chladni discovered in 1787
        let wave1 = cos(n * pi * nx) * cos(m * pi * nz);
        let wave2 = cos(m * pi * nx) * cos(n * pi * nz);
        let vibrationIntensity = abs(wave1 - wave2);

        // 3. COLLISION WITH THE PLATE
        if (pos.y <= 0.08) { // 0.08 is the radius of our particles
            pos.y = 0.08;
            
            // If they are on a node (intensity near 0), they stop moving (settle).
            // If they are on an antinode, the plate violently kicks them upwards!
            vel.y = abs(vel.y) * 0.4 + (vibrationIntensity * 35.0);
            
            // Add a tiny bit of horizontal scatter so they don't bounce straight up forever
            vel.x += (hash(&prngState) - 0.5) * vibrationIntensity * 10.0;
            vel.z += (hash(&prngState) - 0.5) * vibrationIntensity * 10.0;
        }

        // Apply friction/drag so they settle properly into the nodes
        vel.x *= 0.95;
        vel.z *= 0.95;
        
        pos += vel * dt;

        // Keep them on the plate
        pos.x = clamp(pos.x, -49.0, 49.0);
        pos.z = clamp(pos.z, -49.0, 49.0);

        // Write Back State
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        // Output to Render Buffer
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
    }
`;

export const sandRenderShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) worldPos: vec3<f32>,
        @location(1) normal: vec3<f32>
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @location(1) normal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);

        // Simple rotation based on velocity to make them look like tumbling rocks
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]);
        let speed = length(vel);
        
        let worldPosition = localPos + pos;
        
        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.worldPos = worldPosition;
        out.normal = normal; // Pass normal to fragment for simple PBR lighting
        return out;
    }

    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        // Metallic Pearl Lighting
        let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.2));
        let viewDir = normalize(camera.eye - in.worldPos);
        let halfVector = normalize(lightDir + viewDir);

        let diff = max(dot(in.normal, lightDir), 0.0);
        let spec = pow(max(dot(in.normal, halfVector), 0.0), 64.0);

        let baseColor = vec3<f32>(0.3, 0.3, 0.35); // Warm gold/silver
        let ambient = vec3<f32>(0.1, 0.1, 0.15);

        let finalColor = ambient + (baseColor * diff) + vec3<f32>(spec);
        return vec4<f32>(finalColor, 1.0);
    }
`;

export const plateRenderShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> dummy_ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) worldPos: vec3<f32>
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>) -> VertexOut {
        var out: VertexOut;
        let keep_alive_ecs=dummy_ecs[0];
        // Shift the plate slightly down so the 0.0 Y-axis is the surface
        let worldPosition = localPos + vec3<f32>(0.0, -0.5, 0.0); 
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.worldPos = worldPosition;
        return out;
    }

    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        // We replicate the Chladni math here to draw glowing lines where the nodes are!
        let time = camera.simTime;
        let pi = 3.14159265;
        let n = 3.0 + floor(sin(time * 0.2) * 2.0); 
        let m = 4.0 + floor(cos(time * 0.15) * 2.0);
        
        let nx = in.worldPos.x / 50.0;
        let nz = in.worldPos.z / 50.0;

        let wave1 = cos(n * pi * nx) * cos(m * pi * nz);
        let wave2 = cos(m * pi * nx) * cos(n * pi * nz);
        let intensity = abs(wave1 - wave2);

        // Draw the plate as dark obsidian, with glowing blue lines indicating the nodes
        var color = vec3<f32>(0.05, 0.05, 0.08); 
        
        // If intensity is very close to 0, color it neon cyan
        if (intensity < 0.15) {
            let glow = 1.0 - (intensity / 0.15);
            color = mix(color, vec3<f32>(0.0, 0.8, 1.0), glow);
        }

        return vec4<f32>(color, 1.0);
    }
`;