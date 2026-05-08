export const morphogenesisComputeShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
    struct SimParams {
        feed: f32,
        kill: f32,
        timeScale: f32, // <-- Stole one float from padding!
        pad: f32,// WebGPU 16-byte alignment padding
        baseColor: vec4<f32>,
        peakColor: vec4<f32>
    }
    @group(1) @binding(0) var<uniform> params: SimParams;
    @group(0) @binding(0) var<uniform> camera: Camera; 
    
    // Binding 1: Physics Buffer (We read AND write directly to this)
    @group(0) @binding(1) var<storage, read_write> stateGrid: array<f32>; 
    
    // Binding 2: Visual Buffer (We copy the results here for the Vertex Shader)
    @group(0) @binding(2) var<storage, read_write> renderGrid: array<f32>; 
    
    @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

    const GRID_SIZE = 1024i; // Cast to i32 for safe modulo math
    const STRIDE = 4u;

    fn get_idx(x: i32, y: i32) -> u32 {
        let wrapX = u32((x + GRID_SIZE) % GRID_SIZE);
        let wrapY = u32((y + GRID_SIZE) % GRID_SIZE);
        return (wrapY * u32(GRID_SIZE) + wrapX) * STRIDE;
    }

    @compute @workgroup_size(64,1,1)
    fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        // 65536u for 256, 1048576u for 1024
        if (idx >= 1048576u) { return; } 
        
        if (idx == 0u) {
        
           let keep_alive=camera.viewProj;
            atomicMax(&drawArgs.instanceCount, 1u); 
        }

        let gridX = i32(idx % 1024u);
        let gridY = i32(idx / 1024u);
        let base = idx * STRIDE;
        
        // Turing Pattern Parameters
        let dA = 1.0;          
        let dB = 0.5;          
        let feed = params.feed;      
        let kill = params.kill;      
        let dt = 0.8 * params.timeScale;// Slightly lowered to guarantee mathematical stability

        // 1. Read Current State
        let center_A = stateGrid[base];
        let center_B = stateGrid[base + 1u];

        // 2. Laplacian
        var lapA = -center_A;
        var lapB = -center_B;

        lapA += stateGrid[get_idx(gridX - 1, gridY)] * 0.2; 
        lapB += stateGrid[get_idx(gridX - 1, gridY) + 1u] * 0.2;
        lapA += stateGrid[get_idx(gridX + 1, gridY)] * 0.2; 
        lapB += stateGrid[get_idx(gridX + 1, gridY) + 1u] * 0.2;
        lapA += stateGrid[get_idx(gridX, gridY - 1)] * 0.2; 
        lapB += stateGrid[get_idx(gridX, gridY - 1) + 1u] * 0.2;
        lapA += stateGrid[get_idx(gridX, gridY + 1)] * 0.2; 
        lapB += stateGrid[get_idx(gridX, gridY + 1) + 1u] * 0.2;

        lapA += stateGrid[get_idx(gridX - 1, gridY - 1)] * 0.05; 
        lapB += stateGrid[get_idx(gridX - 1, gridY - 1) + 1u] * 0.05;
        lapA += stateGrid[get_idx(gridX + 1, gridY - 1)] * 0.05; 
        lapB += stateGrid[get_idx(gridX + 1, gridY - 1) + 1u] * 0.05;
        lapA += stateGrid[get_idx(gridX - 1, gridY + 1)] * 0.05; 
        lapB += stateGrid[get_idx(gridX - 1, gridY + 1) + 1u] * 0.05;
        lapA += stateGrid[get_idx(gridX + 1, gridY + 1)] * 0.05; 
        lapB += stateGrid[get_idx(gridX + 1, gridY + 1) + 1u] * 0.05;

        // 3. Reaction Equation
        let reaction = center_A * center_B * center_B;
        let next_A = clamp(center_A + (dA * lapA - reaction + feed * (1.0 - center_A)) * dt, 0.0, 1.0);
        let next_B = clamp(center_B + (dB * lapB + reaction - (kill + feed) * center_B) * dt, 0.0, 1.0);

        // 4. Save In-Place (Creates a cool organic drift effect)
        stateGrid[base] = next_A;
        stateGrid[base + 1u] = next_B;

        // 5. Copy to Render Array for the Vertex Shader
        renderGrid[base] = next_A;
        renderGrid[base + 1u] = next_B;
    }
`;

export const morphogenesisRenderShader = `
    struct Camera { viewProj: mat4x4<f32>, eye: vec3<f32>, simTime: f32 };
    @group(0) @binding(0) var<uniform> camera: Camera;
    struct SimParams {
        feed: f32,
        kill: f32,
        pad: vec2<f32>,
        baseColor: vec4<f32>,
        peakColor: vec4<f32>
    }
    @group(1) @binding(0) var<uniform> params: SimParams;
    
    // Reads directly from the renderGrid created by the compute shader
    @group(0) @binding(1) var<storage, read> visualGrid: array<f32>; 

    struct VertexOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) color: vec3<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) localPos: vec3<f32>, 
        @location(1) localNormal: vec3<f32>, 
        @location(2) uv: vec2<f32>
    ) -> VertexOut {
        
        let safeUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
        let gridX = u32(safeUV.x * 1023.0); 
        let gridY = u32(safeUV.y * 1023.0);
        let base = (gridY * 1024u + gridX) * 4u;
        
        let chemA = visualGrid[base];
        let chemB = visualGrid[base + 1u];
        let value = chemB - chemA; 

        // Extrude geometry inwards where chemical B has eaten chemical A
        let displacement = localNormal * (value * 5.5);
        let worldPosition = localPos + displacement;

        var out: VertexOut;
        out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
        
        
        
        let baseColor = params.baseColor.rgb; 
        let peakColor = params.peakColor.rgb;
        out.color = mix(baseColor, peakColor, smoothstep(-0.2, 0.2, value));
        
        // Color mapping: Purple/Black where A is dominant, Neon Green where B is dominant
        //out.color = mix(vec3<f32>(0.1, 0.0, 0.2), vec3<f32>(0.2, 1.0, 0.5), smoothstep(-0.2, 0.2, value));
        
        return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0); 
    }
`;
//
// (feed = 0.055, kill = 0.062), will generate a Coral or Labyrinthine Maze pattern.
//
// Mitosis (Dividing Spots): feed = 0.036, kill = 0.065
//
// Effect: Single dots will grow slightly, become unstable in the center, and divide into two dots, continuously replicating until they fill the space in a hexagonal grid.
//
//     Pulsating / Moving Spots: feed = 0.014, kill = 0.054
//
// Effect: Spots of chemical B will actively "swim" around the grid, repelling each other and constantly moving rather than settling into a static pattern.
//
//     Chaos / Boiling: feed = 0.026, kill = 0.051
//
// Effect: The pattern never settles. It continuously bubbles, merges, and pops like boiling liquid or a restless fluid dynamics simulation.
//
// Holes (U-Skate World): feed = 0.039, kill = 0.058
//
// Effect: The inverse of spots. Chemical B dominates the screen (your neon green), while stable "holes" of Chemical A (your dark purple) form and occasionally drift or divide.
//
//     Worms / Short Stripes: feed = 0.078, kill = 0.061
//
// Effect: Forms isolated, short, wriggling stripes that don't connect into a massive maze, resembling static bacteria or worms.
//
// let baseColor = vec3<f32>(0.3, 0.02, 0.05); // Deep meaty red
// let peakColor = vec3<f32>(0.9, 0.75, 0.65); // Pale flesh/peach
// out.color = mix(baseColor, peakColor, smoothstep(-0.2, 0.2, value));
//
// let baseColor = vec3<f32>(0.02, 0.05, 0.15); // Midnight ocean blue
// let peakColor = vec3<f32>(0.2, 0.9, 0.8);    // Glowing cyan/teal
// out.color = mix(baseColor, peakColor, smoothstep(-0.2, 0.2, value));
//
// let baseColor = vec3<f32>(0.15, 0.1, 0.05); // Rotten bark/dirt brown
// let peakColor = vec3<f32>(0.9, 0.4, 0.1);   // Toxic fungal orange
// out.color = mix(baseColor, peakColor, smoothstep(-0.2, 0.2, value));