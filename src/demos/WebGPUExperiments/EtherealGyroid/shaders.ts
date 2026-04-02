export const gyroidComputeShader = `
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    
    @group(0) @binding(0) var<uniform> camera: Camera; 
    @group(0) @binding(1) var<storage, read_write> physicsState: array<f32>;
    @group(0) @binding(2) var<storage, read_write> renderData: array<f32>;
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    // Helper: Palette generator for iridescent colors
    fn cosPalette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
        return a + b * cos(6.28318 * (c * t + d));
    }

    @compute @workgroup_size(64)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= 250000u) { return; } 

        let time = camera.simTime * 0.2; // Slow time down for majestic flow
        let base = idx * 14u;

        var pos = vec3<f32>(physicsState[base + 1u], physicsState[base + 2u], physicsState[base + 3u]);
        var vel = vec3<f32>(physicsState[base + 4u], physicsState[base + 5u], physicsState[base + 6u]);

        // --- THE MATH: Triply Periodic Minimal Surfaces (TPMS) ---
        // Scale determines the frequency/tightness of the labyrinth
        let scale = 0.05; 
        let p = pos * scale;

        // Equation 1: The Gyroid
        let gyroid = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
        
        // Equation 2: The Schwarz P Surface
        let schwarz = cos(p.x) + cos(p.y) + cos(p.z);
        
        // Morph between them smoothly over time
        let morph = sin(time * 0.5) * 0.5 + 0.5;
        let surfaceDist = mix(gyroid, schwarz, morph);

        // Calculate the Gradient (Normal of the surface) analytically for the morphed surface
        // Using finite difference here for simplicity and to easily handle the morphing
        let eps = 0.01;
        let dx = mix(
            sin(p.x+eps)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x+eps),
            cos(p.x+eps) + cos(p.y) + cos(p.z), morph
        ) - surfaceDist;
        
        let dy = mix(
            sin(p.x)*cos(p.y+eps) + sin(p.y+eps)*cos(p.z) + sin(p.z)*cos(p.x),
            cos(p.x) + cos(p.y+eps) + cos(p.z), morph
        ) - surfaceDist;
        
        let dz = mix(
            sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z+eps) + sin(p.z+eps)*cos(p.x),
            cos(p.x) + cos(p.y) + cos(p.z+eps), morph
        ) - surfaceDist;

        var normal = normalize(vec3<f32>(dx, dy, dz));
        if (length(normal) < 0.001) { normal = vec3<f32>(0.0, 1.0, 0.0); }

        // --- THE FORCES ---
        // 1. Surface Adhesion: Pull particles strongly toward the surface (where surfaceDist == 0)
        let adhesionForce = -normal * surfaceDist * 250.0;

        // 2. Tangential Flow: Make them slide ALONG the surface using a cross product.
        // We cross the normal with an arbitrary swirling vector (based on position) to create "magnetic" currents.
        let flowAxis = normalize(vec3<f32>(sin(time), cos(time*0.8), sin(time*1.2)));
        var tangentForce = cross(normal, flowAxis) * 120.0;
        
        // Add local turbulence to the tangent flow
        tangentForce += cross(normal, pos) * 0.5;

        // 3. The Soft Leash: Keep them from escaping to infinity
        let distFromCenter = length(pos);
        var leashForce = vec3<f32>(0.0);
        if (distFromCenter > 180.0) {
            leashForce = -normalize(pos) * (distFromCenter - 180.0) * 10.0;
        }

        var force = adhesionForce + tangentForce + leashForce;

        // INTEGRATE
        let dt = 0.016; 
        vel += force * dt;
        vel *= 0.90; // High friction keeps them glued to the surface instead of orbiting wildly
        pos += vel * dt;

        // --- PROCEDURAL IRIDESCENCE ---
        // Color based on the normal direction (looks like pearlescent bismuth or beetle wings)
        let n = normal * 0.5 + 0.5; 
        let paletteT = dot(normal, vec3<f32>(0.577)) * 0.5 + 0.5 + morph;
        var color = cosPalette(
            paletteT, 
            vec3<f32>(0.5, 0.5, 0.5), 
            vec3<f32>(0.5, 0.5, 0.5), 
            vec3<f32>(2.0, 1.0, 0.0), 
            vec3<f32>(0.5, 0.20, 0.25)
        );
        
        // Highlight areas where particles are moving fast
        let speed = length(vel);
        color += vec3<f32>(speed * 0.02); 

        // WRITE BACK
        physicsState[base + 1u] = pos.x; physicsState[base + 2u] = pos.y; physicsState[base + 3u] = pos.z;
        physicsState[base + 4u] = vel.x; physicsState[base + 5u] = vel.y; physicsState[base + 6u] = vel.z;

        let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
        let wBase = writeIdx * 14u;
        
        for(var i = 0u; i < 7u; i = i + 1u) { renderData[wBase + i] = physicsState[base + i]; }
        renderData[wBase + 11u] = color.r; 
        renderData[wBase + 12u] = color.g; 
        renderData[wBase + 13u] = color.b;
    }
`;

export const gyroidRenderShader = `
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
        let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Stretch pyramids along their velocity vector to look like glowing strings/sparks
        let forward = normalize(vel + vec3<f32>(0.001));
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);
        
        var right = cross(worldUp, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);
        
        // Scale based on speed - faster particles stretch out more
        let speed = clamp(length(vel), 1.0, 50.0);
        let scaleVec = vec3<f32>(0.15, 0.15, 0.3 + speed * 0.1); 
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;
        
        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        // Depth-fade attenuation baked into color for a foggy look
        let depth = out.pos.w;
        let fog = clamp(1.0 - (depth / 350.0), 0.0, 1.0);
        out.color = color * 2.0 * fog; // Overdrive colors for bloom
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;