// demos/WebGPUExperiments/Singularity/shaders.ts

export const singularityComputeShader = `
    struct IndirectDrawArgs {
        indexCount: u32,
        instanceCount: atomic<u32>, 
        firstIndex: u32,
        baseVertex: u32,
        firstInstance: u32,
    };

    struct Camera { 
        viewProj: mat4x4<f32>,
        eye: vec3<f32>,
        simTime: f32 
    };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    
    // THE PHYSICS STATE: The GPU reads AND writes to this so particles have memory!
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    
    // THE RENDER BUFFER: The GPU copies the updated data here for the Render Pass
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;


    @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        // 100,000 particles!
        if (idx >= 100000u) { return; } 

        let time = camera.simTime;
        let base = idx * 14u;

        // 1. Read Current State
        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        // We repurposed slots 4, 5, 6 to store Velocity!
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // --- THE PHYSICS ENGINE ---
        
        // // A. Black Hole Gravity (F = G * m1 * m2 / dist^2)
        let dir = -pos; 
        let dist = max(length(dir), 1.0); // Prevent division by zero
        let normDir = dir / dist;
        let gravityStrength = 8000.0 / (dist * dist + 50.0);
        var force = normDir * gravityStrength;

        // B. Accretion Disk Swirl (Cross product forces them to orbit the Y axis)
        let swirlDir = normalize(cross(normDir, vec3<f32>(0.0, 1.0, 0.0)));
        force += swirlDir * (gravityStrength * 2.2);

        // C. SIGGRAPH Fluid Dynamics (Pseudo-Curl Noise Turbulence)
        // This creates beautiful, organic wisps and tendrils
        let noiseScale = 0.15;
        let nx = sin(pos.y * noiseScale + time) + cos(pos.z * noiseScale);
        let ny = sin(pos.z * noiseScale + time) + cos(pos.x * noiseScale);
        let nz = sin(pos.x * noiseScale + time) + cos(pos.y * noiseScale);
        force += vec3<f32>(nx, ny, nz) * 8.0;

        // D. Relativistic Jets (If they get sucked in too close, shoot them out the poles!)
        if (dist < 12.0) {
            let pole = sign(pos.y + 0.001); // Up or Down
            force += vec3<f32>(0.0, pole * 800.0, 0.0);
        }

        // 2. Integrate Physics
        let dt = 0.016; // 60fps fixed step
        vel += force * dt;
        vel *= 0.96; // Cosmic Drag (prevents exploding simulation)
        pos += vel * dt;

        // 3. Dynamic Color based on Speed
        let speed = length(vel);
        let coolColor = vec3<f32>(0.05, 0.0, 0.2);  // Deep space purple
        let hotColor = vec3<f32>(0.0, 0.8, 1.0);    // Plasma cyan
        let coreColor = vec3<f32>(1.0, 0.9, 0.8);   // White hot
        
        var finalColor = mix(coolColor, hotColor, smoothstep(0.0, 40.0, speed));
        finalColor = mix(finalColor, coreColor, smoothstep(40.0, 80.0, speed));

        // 4. Save State back to Physics Buffer
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        // 5. Pack data for the Render Pass (Atomic Add to build the draw list)
        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        for(var i = 0u; i < 14u; i = i + 1u) {
            renderData[wBase + i] = physicsState[base + i];
        }
        
        // Write our dynamic color into the render slots
        renderData[wBase + 11u] = finalColor.r; 
        renderData[wBase + 12u] = finalColor.g; 
        renderData[wBase + 13u] = finalColor.b;
    }
`;

export const singularityRenderShader = `
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
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]); // Grab velocity!
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // MOTION BLUR TRICK: Stretch the geometry along the velocity vector!
        let speed = length(vel);
        let stretchDir = normalize(vel + vec3<f32>(0.001));
        
        // If localPos.y > 0, pull it forward along the velocity path
        let isFrontVertex = step(0.0, localPos.y); 
        let motionStretch = stretchDir * (speed * 0.15) * isFrontVertex;
        
        let worldPosition = (localPos * 0.4) + pos + motionStretch;

        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        // HDR Boost
        out.color = baseColor * 2.5; 
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); // Pure emissive light
    }
`;