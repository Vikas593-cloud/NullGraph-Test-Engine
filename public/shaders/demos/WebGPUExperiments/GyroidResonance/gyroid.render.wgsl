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
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Velocity alignment math
        let forward = normalize(vel + vec3<f32>(0.0001, 0.0, 0.0));
        var right = cross(vec3<f32>(0.0, 1.0, 0.0), forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let up = cross(forward, right);
        let rotMat = mat3x3<f32>(right, up, forward);

        // Stretch into shards based on velocity
        let speed = length(vel);
        let scaleVec = vec3<f32>(0.2, 0.2, 0.4 + speed * 0.08);

        let worldPosition = rotMat * (localPos * scaleVec) + pos;
        let screenPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        var out: VertexOut;
        out.pos = screenPos;
        // Fade out into the distance
        let depthFade = clamp(1.0 - (screenPos.w / 350.0), 0.0, 1.0);
        out.color = baseColor * depthFade;
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0);
    }