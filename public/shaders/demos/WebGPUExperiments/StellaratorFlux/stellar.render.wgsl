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

        let speed = length(vel);
        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        let worldUp = vec3<f32>(0.0, 1.0, 0.0);

        var right = cross(worldUp, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);

        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);

        // Stretch the particles radically based on speed to look like light streaks
        let scaleVec = vec3<f32>(0.15, 0.15, 0.5 + speed * 0.12);
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Boost color for the Uncharted 2 Tonemapper in the post-pass
        out.color = baseColor * 2.5;
        out.dist = screenPos.w;
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>, @location(1) dist: f32) -> @location(0) vec4<f32> {
        let depthAlpha = clamp(1.0 - (dist / 450.0), 0.0, 1.0);
        return vec4<f32>(color, depthAlpha);
    }