export const gBufferRenderShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) clipPos: vec4<f32>,
        @location(0) worldPos: vec3<f32>,
        @location(1) worldNormal: vec3<f32>,
        @location(2) albedo: vec3<f32>
    };

    @vertex
    fn vs_main(
        @location(0) localPos: vec3<f32>, 
        @location(1) localNormal: vec3<f32>, 
        @location(2) uv: vec2<f32>, 
        @location(3) vertexColor: vec4<f32>, // <-- Captured from CompleteLayout
        @builtin(instance_index) iIdx: u32
    ) -> VertexOut {
        let base = iIdx * 14u;
        
        // Instance Data (Position & Dynamic Tint)
        let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
        let instanceTint = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

        let worldPosition = localPos + pos;
        
        var out: VertexOut;
        out.clipPos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        out.worldPos = worldPosition;
        out.worldNormal = normalize(localNormal); 
        
        // Multiply the geometry's intrinsic color by the dynamic instance tint!
        // (If your cube geometry defaults to white, this just outputs the instance tint)
        out.albedo = vertexColor.rgb * instanceTint; 
        
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
        @location(2) position: vec4<f32>
    };

    @fragment
    fn fs_main(in: VertexOut) -> GBufferOutput {
        var out: GBufferOutput;
        out.albedo = vec4<f32>(in.albedo, 1.0);
        out.normal = vec4<f32>(in.worldNormal, 1.0);
        out.position = vec4<f32>(in.worldPos, 1.0);
        return out;
    }
`;