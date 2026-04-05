// demos/HologramEffectExample.ts
import { NullGraph, Camera } from 'null-graph';
import { pyramidIndices, pyramidVertices } from "../data";
import { UIState } from "../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupHologramEffect(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 300;
    const STRIDE = 14;

    // =========================================================
    // 1. OFFSCREEN TEXTURES (High-Res Render Target)
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
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
    });

    // =========================================================
    // PASS 1: THE 3D SCENE (Draws to memory)
    // =========================================================
    const scenePass = engine.createPass({
        name: 'Offscreen 3D Scene',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.01, g: 0.05, b: 0.05, a: 1.0 }, // Very dark teal background
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
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNormal: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>((localPos * scale) + pos, 1.0);
            out.color = color;
            out.normal = localNormal;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(1.0, 3.0, 2.0));
            // Higher base lighting so the edge detector has clear geometry to read
            let diffuse = max(dot(normal, lightDir), 0.4); 
            return vec4<f32>(color * diffuse, 1.0);
        }
    `;
    const pyrGeom=Primitives.createPyramid(StandardLayout,1.0,1.0,1.0)
    pyrGeom.upload(engine)
    const sceneBatch = engine.createBatch(scenePass, {
        shaderCode: sceneShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        vertexLayouts:pyrGeom.layout.getWebGPUDescriptor()
    });

    // USING THE PYRAMIDS!
    engine.setBatchGeometry(
        sceneBatch,
        pyrGeom.vertexBuffer!,
        pyrGeom.indexBuffer!,
        pyrGeom.indices.length
    );

    // =========================================================
    // PASS 2: NEON EDGE DETECT & HOLOGRAM FILTER
    // =========================================================
    const holoPass = engine.createPass({
        name: 'Hologram Filter Pass',
        isMainScreenPass: true
    });

    const holoShader = `
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
            // Giant triangle trick
            var pos = array<vec2<f32>, 3>(
                vec2<f32>(-1.0, -1.0), vec2<f32>( 3.0, -1.0), vec2<f32>(-1.0,  3.0)
            );
            let _keepCameraAlive = camera.viewProj[0][0];
            var uv = array<vec2<f32>, 3>(
                vec2<f32>(0.0, 1.0), vec2<f32>(2.0, 1.0), vec2<f32>(0.0, -1.0)
            );
            var out: VertexOut;
            out.pos = vec4<f32>(pos[vIdx], 0.0, 1.0);
            out.uv = uv[vIdx];
            return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            let time = ecs[0];

            // 1. Digital Heatwave Distortion (Wobbles the X axis based on Y)
            var distUV = uv;
            distUV.x += sin(uv.y * 30.0 + time * 4.0) * 0.0015;

            // 2. Sample Base Image
            let baseColor = textureSample(screenTex, screenSamp, distUV).rgb;

            // 3. Edge Detection (Sampling neighbors to find high contrast lines)
            let texel = vec2<f32>(1.0 / 2048.0, 1.0 / 2048.0) * 1.5;
            let n = textureSample(screenTex, screenSamp, distUV + vec2<f32>(0.0, texel.y)).rgb;
            let s = textureSample(screenTex, screenSamp, distUV + vec2<f32>(0.0, -texel.y)).rgb;
            let e = textureSample(screenTex, screenSamp, distUV + vec2<f32>(texel.x, 0.0)).rgb;
            let w = textureSample(screenTex, screenSamp, distUV + vec2<f32>(-texel.x, 0.0)).rgb;
            
            // Calculate edge intensity
            let edge = length(abs(baseColor - n) + abs(baseColor - s) + abs(baseColor - e) + abs(baseColor - w));
            let edgeMask = smoothstep(0.05, 0.3, edge); // Crispy lines

            // 4. Holographic Scanline (Scrolling bright bar)
            let scanline = sin(uv.y * 150.0 - time * 8.0) * 0.5 + 0.5;
            let holoGlow = vec3<f32>(0.0, 1.0, 0.9) * scanline * 0.4; // Cyan

            // 5. Composite Everything Together
            // - Darken the original 3D scene significantly
            // - Blast the detected edges with Neon Pink
            // - Overlay the Cyan holographic scanline
            let darkScene = baseColor * 0.25;
            let neonEdges = vec3<f32>(1.0, 0.1, 0.8) * edgeMask * 2.5;
            
            let finalColor = darkScene + neonEdges + (holoGlow * baseColor);

            return vec4<f32>(finalColor, 1.0);
        }
    `;

    const holoBatch = engine.createBatch(holoPass, {
        shaderCode: holoShader,
        strideFloats: 1, // Only passing Time
        maxInstances: 1,
        vertexLayouts: [] // Draw 3 vertices for the screen quad
    });

    engine.attachTextureMaterial(holoBatch, offscreenTexture.createView(), sampler);

    // =========================================================
    // DATA & ANIMATION
    // =========================================================
    const sceneData = new Float32Array(MAX_INSTANCES * STRIDE);

    // Arrange pyramids in a cool Galaxy/Vortex shape
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        const radius = (i / MAX_INSTANCES) * 60 + 5; // Distance from center
        const angle = i * 0.6; // Spiral rotation

        sceneData[base + 1] = Math.cos(angle) * radius;
        sceneData[base + 2] = (Math.random() - 0.5) * 15; // Slight Y variance
        sceneData[base + 3] = Math.sin(angle) * radius;

        // Make them slightly long/stretched crystals
        sceneData[base + 8] = 2.0;
        sceneData[base + 9] = 4.0;
        sceneData[base + 10] = 2.0;

        // Base color is a muted blue/grey (the post-process does the heavy lifting)
        sceneData[base + 11] = 0.2; // R
        sceneData[base + 12] = 0.6; // G
        sceneData[base + 13] = 0.8; // B
    }

    const postProcessData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            // Animate Scene: Make the entire vortex slowly rotate in 3D space
            const rotationSpeed = 0.005;
            const cosR = Math.cos(rotationSpeed);
            const sinR = Math.sin(rotationSpeed);

            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;

                // Read current X and Z
                const x = sceneData[base + 1];
                const z = sceneData[base + 3];

                // Apply 2D rotation matrix to X and Z to spin the vortex
                sceneData[base + 1] = x * cosR - z * sinR;
                sceneData[base + 3] = x * sinR + z * cosR;

                // Make them bob up and down
                sceneData[base + 2] += Math.sin(simTime * 3.0 + i) * 0.02;
            }
            engine.updateBatchData(sceneBatch, sceneData, MAX_INSTANCES);

            // Send Time to Post Process Shader
            postProcessData[0] = simTime;
            engine.updateBatchData(holoBatch, postProcessData, 1);
        },
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            engine.clearPasses();
        }
    };
}