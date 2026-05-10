struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) worldPos: vec3<f32>,
    };

    // Helper to rotate a vector around an arbitrary axis (useful for tumbling debris)
    fn rotate_axis(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
        let s = sin(angle); let c = cos(angle); let ic = 1.0 - c;
        return v * c + cross(axis, v) * s + axis * dot(axis, v) * ic;
    }

    @vertex
    fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNormal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
        let base = iIdx * 14u;
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
        let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        // Give each particle a slight local rotation based on its ID
        let tumbleAxis = normalize(vec3<f32>(f32(iIdx % 3u), f32(iIdx % 5u), 1.0));
        let rotatedLocal = rotate_axis(localPos * scale, tumbleAxis, ecs[base + 1u] * 0.1);

        var out: VertexOut;
        let worldPosition = rotatedLocal + pos;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);

        // Boost color intensity based on how close it is to the center to create a "hot core"
        let distFromCenter = length(pos);
        let coreHeat = smoothstep(15.0, 0.0, distFromCenter) * 5.0; // HDR Glow multiplier

        out.color = baseColor * (1.0 + coreHeat);
        out.normal = rotate_axis(localNormal, tumbleAxis, ecs[base + 1u] * 0.1);
        out.worldPos = worldPosition;
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) worldPos: vec3<f32>) -> @location(0) vec4<f32> {
        let lightDir = normalize(vec3<f32>(0.0, 0.0, 1.0)); // Light from camera
        let diffuse = max(dot(normal, lightDir), 0.2); // Base ambient
        return vec4<f32>(color * diffuse, 1.0); // Outputting > 1.0 values natively for HDR
    }