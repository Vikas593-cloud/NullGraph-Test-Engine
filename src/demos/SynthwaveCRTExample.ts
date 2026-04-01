// demos/SynthwaveCRTExample.ts
import { NullGraph, Camera } from 'null-graph';
import { pyramidIndices, pyramidVertices } from "../data";
import { UIState } from "../ui";

export async function setupSynthwaveCRT(engine: NullGraph, camera: Camera, getState: () => UIState) {
    // 400 instances to create a dense 20x20 grid of "digital terrain"
    const GRID_SIZE = 20;
    const MAX_INSTANCES = GRID_SIZE * GRID_SIZE;
    const STRIDE = 14;

    // =========================================================
    // 1. OFFSCREEN TEXTURES (The pristine 3D render)
    // =========================================================
    const offscreenTexture = engine.device.createTexture({
        size: [2048, 2048],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const offscreenDepth = engine.device.createTexture({
        size: [2048, 2048],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const sampler = engine.device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        // clamp-to-edge is crucial here so our CRT distortion doesn't wrap pixels
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
    });

    // =========================================================
    // PASS 1: CYBER-TERRAIN 3D SCENE
    // =========================================================
    const scenePass = engine.createPass({
        name: 'Offscreen Synthwave Scene',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.02, g: 0.0, b: 0.05, a: 1.0 }, // Very dark purple abyss
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const sceneShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
            @location(1) normal: vec3<f32>,
            @location(2) worldY: f32, // Pass world Y to create a height-based glowing gradient
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNormal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let baseColor = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            let worldPosition = (localPos * scale) + pos;
            out.pos = camera.viewProj * vec4<f32>(worldPosition, 1.0);
            out.color = baseColor;
            out.normal = localNormal;
            out.worldY = worldPosition.y; 
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) worldY: f32) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(0.0, 1.0, 1.0));
            let diffuse = max(dot(normal, lightDir), 0.6); 
            
            // Map height to a Neon gradient: Dark Blue valleys -> Hot Pink peaks
            let heightFactor = smoothstep(-5.0, 5.0, worldY);
            let valleyColor = vec3<f32>(0.0, 0.1, 0.5); // Deep blue
            let peakColor = vec3<f32>(1.0, 0.0, 0.8);   // Neon Pink
            
            let finalColor = mix(valleyColor, peakColor, heightFactor) * color * diffuse;

            // Make the very highest tips glow white-hot
            let glow = smoothstep(3.5, 6.0, worldY) * vec3<f32>(1.0, 1.0, 1.0) * 3.0;

            return vec4<f32>(finalColor + glow, 1.0);
        }
    `;

    const sceneBatch = engine.createBatch(scenePass, {
        shaderCode: sceneShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: [{
            arrayStride: 24, attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
                { shaderLocation: 1, offset: 12, format: 'float32x3' } // Normal
            ]
        }]
    });

    engine.setBatchGeometry(
        sceneBatch,
        engine.bufferManager.createVertexBuffer(pyramidVertices),
        engine.bufferManager.createIndexBuffer(pyramidIndices),
        pyramidIndices.length
    );

    // =========================================================
    // PASS 2: CRT OVERDRIVE & CHROMATIC ABERRATION
    // =========================================================
    const crtPass = engine.createPass({
        name: 'CRT Post Process',
        isMainScreenPass: true
    });

    const crtShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        @group(1) @binding(0) var screenTex: texture_2d<f32>;
        @group(1) @binding(1) var screenSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
            var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0));
            var uv = array<vec2<f32>, 3>(vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0));
            var out: VertexOut;
            let _keepCameraAlive = camera.viewProj[0][0];
            out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
            out.uv = uv[vIdx];
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            let time = ecs[0];

            // 1. CRT Barrel Distortion
            var crtUV = uv * 2.0 - 1.0; // Center UVs to -1.0 to 1.0
            let offset = crtUV.yx / 4.0; 
            crtUV = crtUV + crtUV * offset * offset; 
            crtUV = crtUV * 0.5 + 0.5; // Uncenter back to 0.0 to 1.0

            // 2. Chromatic Aberration
            let caIntensity = 0.005 + sin(time * 3.0) * 0.003;
            let texR = textureSample(screenTex, screenSamp, crtUV + vec2<f32>(caIntensity, 0.0)).r;
            let texG = textureSample(screenTex, screenSamp, crtUV).g;
            let texB = textureSample(screenTex, screenSamp, crtUV - vec2<f32>(caIntensity, 0.0)).b;
            var color = vec3<f32>(texR, texG, texB);

            // 3. Screen Bezel Mask (Replaces the 'if' statement!)
            // step(a, b) returns 1.0 if b >= a, otherwise 0.0
            let inBoundsX = step(0.0, crtUV.x) * step(crtUV.x, 1.0);
            let inBoundsY = step(0.0, crtUV.y) * step(crtUV.y, 1.0);
            let inBounds = inBoundsX * inBoundsY; // 1.0 if inside, 0.0 if outside
            color *= inBounds; // Blacks out the pixels outside the curved CRT glass

            // 4. Scanlines
            let scanline = sin(crtUV.y * 900.0) * 0.04;
            color -= scanline;

            // 5. Color Grading & Contrast
            color = pow(color, vec3<f32>(1.1)); 
            color *= 2.5; 

            // 6. Heavy Vignette
            let vigDistance = length(uv - 0.5);
            let vignette = smoothstep(0.7, 0.35, vigDistance);
            color *= vignette;

            // 7. Flickering screen noise overlay
            let noise = fract(sin(dot(crtUV.xy + time, vec2<f32>(12.9898, 78.233))) * 43758.5453);
            color += vec3<f32>(noise * 0.03); 

            return vec4<f32>(color, 1.0);
        }
    `;

    const crtBatch = engine.createBatch(crtPass, {
        shaderCode: crtShader,
        strideFloats: 1, // Passing time
        maxInstances: 1,
        vertexLayouts: []
    });

    engine.attachTextureMaterial(crtBatch, offscreenTexture.createView(), sampler);

    // =========================================================
    // DATA & ANIMATION SETUP
    // =========================================================
    const sceneData = new Float32Array(MAX_INSTANCES * STRIDE);
    const SPACING = 4.0;

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Arrange in a grid
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        sceneData[base + 1] = (col - GRID_SIZE / 2) * SPACING; // X
        sceneData[base + 2] = 0; // Y (Calculated in update loop)
        sceneData[base + 3] = (row - GRID_SIZE / 2) * SPACING; // Z

        // Scale them to look like tall obelisks/spikes
        sceneData[base + 8] = 1.0;  // Sx
        sceneData[base + 9] = 3.0;  // Sy
        sceneData[base + 10] = 1.0; // Sz

        // Base color multiplier (Shader handles the gradient, so keep this white/grey)
        sceneData[base + 11] = 1.0; // R
        sceneData[base + 12] = 1.0; // G
        sceneData[base + 13] = 1.0; // B
    }

    const postProcessData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            const FLY_SPEED = 15.0;

            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;
                const x = sceneData[base + 1];
                let z = sceneData[base + 3];

                // 1. Move Z forward to simulate flying over the terrain
                z += (FLY_SPEED * 0.016); // Assuming ~60fps delta

                // Infinite scrolling wrap-around
                const maxZ = (GRID_SIZE / 2) * SPACING;
                const minZ = -(GRID_SIZE / 2) * SPACING;
                if (z > maxZ) { z -= (maxZ - minZ); }
                sceneData[base + 3] = z;

                // 2. Math-driven Cyber Terrain (Overlapping sine waves based on X and Z)
                // We add simTime to the wave phase so the waves actually "roll"
                const wave1 = Math.sin(x * 0.3 + simTime * 2.0);
                const wave2 = Math.cos(z * 0.3 + simTime * 1.5);
                const wave3 = Math.sin((x + z) * 0.1 - simTime);

                // Set the Y height
                sceneData[base + 2] = (wave1 * wave2 * 3.0) + (wave3 * 2.0) - 5.0;
            }
            engine.updateBatchData(sceneBatch, sceneData, MAX_INSTANCES);

            // Send Time to Post Process Shader for CRT flicker and Chromatic pulse
            postProcessData[0] = simTime;
            engine.updateBatchData(crtBatch, postProcessData, 1);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}