 struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>
    };

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let vel = vec3<f32>(ecs[base + 4u], ecs[base + 5u], ecs[base + 6u]);
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Stretch cubes along their velocity vector to look like light streaks
        let forward = normalize(vel + vec3<f32>(0.001, 0.0, 0.0));
        let up = vec3<f32>(0.0, 1.0, 0.0);
        var right = cross(up, forward);
        if (length(right) < 0.001) { right = cross(vec3<f32>(1.0, 0.0, 0.0), forward); }
        right = normalize(right);
        let realUp = cross(forward, right);

        let rotMat = mat3x3<f32>(right, realUp, forward);

        let speed = length(vel);
        // Base size 0.2, stretches up to 4.0 units based on speed
        let scaleVec = vec3<f32>(0.2, 0.2, 0.1 + (speed * 0.02));
        let orientedPos = rotMat * (localPos * scaleVec);

        let worldPosition = orientedPos + pos;

        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        // Fade out slightly in the distance to give depth perception back (since depth sorting is off)
        let depthFade = clamp(1.0 - (out.pos.w / 500.0), 0.1, 1.0);
        out.color = baseColor * depthFade;

        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        // Output with an alpha of 1.0, the blend state handles the math!
        return vec4<f32>(color, 1.0);
    }