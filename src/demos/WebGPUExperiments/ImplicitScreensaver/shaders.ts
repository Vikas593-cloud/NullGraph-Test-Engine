export const implicitScreensaverShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<storage, read> ecs: array<f32>;

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) rayDir: vec3<f32>,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
        // 1. Generate Full Screen Triangle
        var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0));
        var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
        
        var out: VertexOut;
        out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
        out.uv = uv[vIdx] * 2.0 - 1.0; // Map to -1 to 1

        // 2. Calculate Ray Direction based on the Camera Inverse View Projection
        // (For a true screensaver, we often just build a lookAt matrix here, 
        // but we'll use a simple perspective projection from the eye)
        let fov = 1.0; 
        let forward = normalize(vec3<f32>(0.0, 0.0, 0.0) - camera.eye);
        let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), forward));
        let up = cross(forward, right);
        
        out.rayDir = normalize(forward * fov + right * out.uv.x + up * out.uv.y);
        
        return out;
    }

    // --- SDF MATH FUNCTIONS ---

    // Smoothly blends two shapes together (the "goo" effect)
    fn smin(a: f32, b: f32, k: f32) -> f32 {
        let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }

    fn sdSphere(p: vec3<f32>, s: f32) -> f32 {
        return length(p) - s;
    }

    fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
        let q = abs(p) - b;
        return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
    }

    // --- THE IMPLICIT SCENE ---
    fn map(pos: vec3<f32>, time: f32) -> f32 {
        // 1. Fold space to create an infinite grid
        let spacing = 6.0;
        let q = pos - spacing * round(pos / spacing); 

        // 2. Animate shape transformations
        let anim = sin(time * 2.0 + pos.x * 0.5 + pos.z * 0.5) * 0.5 + 0.5;

        // 3. Define Shapes
        let sphere = sdSphere(q, 1.2);
        
        // A twisting box
        var boxPos = q;
        let c = cos(time); let s = sin(time);
        boxPos = vec3<f32>(boxPos.x * c - boxPos.y * s, boxPos.x * s + boxPos.y * c, boxPos.z);
        let box = sdBox(boxPos, vec3<f32>(0.8, 0.8, 0.8));

        // 4. Blend them together!
        return smin(sphere, box, 0.8 * anim + 0.2);
    }

    // Calculates the surface normal by sampling the gradient of the SDF
    fn calcNormal(p: vec3<f32>, time: f32) -> vec3<f32> {
        let e = vec2<f32>(0.001, 0.0);
        return normalize(vec3<f32>(
            map(p + e.xyy, time) - map(p - e.xyy, time),
            map(p + e.yxy, time) - map(p - e.yxy, time),
            map(p + e.yyx, time) - map(p - e.yyx, time)
        ));
    }

    @fragment
    fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
        let time = ecs[0];
        let ro = camera.eye;       // Ray Origin
        let rd = in.rayDir;        // Ray Direction

        // --- RAY MARCHING LOOP ---
        var t = 0.0;           // Total distance traveled
        var hit = false;
        let MAX_STEPS = 100u;
        let MAX_DIST = 100.0;
        let SURF_DIST = 0.001;

        for(var i = 0u; i < MAX_STEPS; i++) {
            let p = ro + rd * t;        // Current position along the ray
            let d = map(p, time);       // Distance to nearest surface
            
            t += d;                     // March forward

            if (d < SURF_DIST) {
                hit = true; break;      // We hit something!
            }
            if (t > MAX_DIST) {
                break;                  // Escaped to infinity
            }
        }

        // --- LIGHTING & COLORING ---
        var finalColor = vec3<f32>(0.05, 0.02, 0.08); // Background void color

        if (hit) {
            let p = ro + rd * t;
            let normal = calcNormal(p, time);
            
            // Base color based on world position (creates a nice gradient)
            let albedo = 0.5 + 0.5 * cos(time + p.xyx * 0.2 + vec3<f32>(0.0, 2.0, 4.0));

            // Lighting setup
            let lightDir = normalize(vec3<f32>(sin(time), 1.0, cos(time)));
            
            // Diffuse
            let dif = max(dot(normal, lightDir), 0.0);
            
            // Ambient Occlusion (fake it based on how many steps it took to hit)
            let ao = 1.0 - f32(t) / MAX_DIST; 

            // Combine
            finalColor = albedo * dif * ao + (albedo * 0.1); 
        }

        // Fog to blend smoothly into the background void
        finalColor = mix(finalColor, vec3<f32>(0.05, 0.02, 0.08), 1.0 - exp(-0.005 * t * t));

        // Gamma correction
        finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));

        return vec4<f32>(finalColor, 1.0);
    }
`;