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