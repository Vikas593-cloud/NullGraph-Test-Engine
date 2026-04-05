// demos/CRTEffectExample.ts
import { NullGraph, Camera } from 'null-graph';
import {UIState} from "../types";
import {Primitives, StandardLayout} from "null-graph/geometry";

export async function setupCRTEffect(engine: NullGraph, camera: Camera, getState: () => UIState) {
    const MAX_INSTANCES = 200;
    const STRIDE = 14;

    // =========================================================
    // 1. OFFSCREEN TEXTURES (High-Res Render Target)
    // =========================================================
    // We render the 3D scene here first.
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
            clearValue: { r: 0.05, g: 0.02, b: 0.1, a: 1.0 }, // Deep purple background
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
            let lightDir = normalize(vec3<f32>(1.0, 2.0, 1.0));
            let diffuse = max(dot(normal, lightDir), 0.6);
            return vec4<f32>(color * diffuse, 1.0);
        }
    `;
    const octahedronGeom=Primitives.createOctahedron(StandardLayout,1.0,1.0,1.0)
    octahedronGeom.upload(engine)

    const sceneBatch = engine.createBatch(scenePass, {
        shaderCode: sceneShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: octahedronGeom.layout.getWebGPUDescriptor()
    });

    engine.setBatchGeometry(
        sceneBatch,
        octahedronGeom.vertexBuffer!,
        octahedronGeom.indexBuffer!,
        octahedronGeom.indices.length
    );

    // =========================================================
    // PASS 2: THE CRT GLITCH FILTER (Draws to Screen)
    // =========================================================
    const crtPass = engine.createPass({
        name: 'CRT Filter Pass',
        isMainScreenPass: true
    });

    const crtShader = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        
        // We hijack the ECS array to pass in simulation time!
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        @group(1) @binding(0) var screenTex: texture_2d<f32>;
        @group(1) @binding(1) var screenSamp: sampler;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
            // THE GIANT TRIANGLE TRICK
            // 3 vertices that stretch far beyond the screen bounds, 
            // perfectly covering the view with a single triangle.
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
            let time = ecs[0]; // Read time from CPU

            // 1. Chromatic Aberration (Shift Red and Blue channels apart)
            let offset = sin(time * 5.0) * 0.003 + 0.005; 
            let r = textureSample(screenTex, screenSamp, uv + vec2<f32>(offset, 0.0)).r;
            let g = textureSample(screenTex, screenSamp, uv).g;
            let b = textureSample(screenTex, screenSamp, uv - vec2<f32>(offset, 0.0)).b;

            // 2. CRT Scanlines (Horizontal rolling lines)
            let scanline = sin(uv.y * 800.0 - (time * 15.0)) * 0.01;

            // 3. Vignette (Darken corners)
            let dist = distance(uv, vec2<f32>(0.5, 0.5));
            let vignette = smoothstep(0.8, 0.2, dist);

            // Combine them all
            let finalColor = vec3<f32>(r, g, b) - scanline;
            return vec4<f32>(finalColor * vignette, 1.0);
        }
    `;

    const crtBatch = engine.createBatch(crtPass, {
        shaderCode: crtShader,
        strideFloats: 1, // Only passing 1 float (Time)
        maxInstances: 1,
        vertexLayouts: [] // NO GEOMETRY! Triggers engine's "draw(3)" path.
    });

    engine.attachTextureMaterial(crtBatch, offscreenTexture.createView(), sampler);

    // =========================================================
    // DATA & ANIMATION
    // =========================================================
    const sceneData = new Float32Array(MAX_INSTANCES * STRIDE);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;
        // Position them in a massive floating cloud
        sceneData[base + 1] = (Math.random() - 0.5) * 80;
        sceneData[base + 2] = (Math.random() - 0.5) * 80;
        sceneData[base + 3] = (Math.random() - 0.5) * 80;

        // Scale them up a bit
        sceneData[base + 8] = 3.0; sceneData[base + 9] = 3.0; sceneData[base + 10] = 3.0;

        // Neon Cyberpunk Colors (Cyan / Magenta)
        sceneData[base + 11] = Math.random() > 0.5 ? 0.0 : 1.0; // R
        sceneData[base + 12] = Math.random() > 0.5 ? 1.0 : 0.0; // G
        sceneData[base + 13] = 1.0;                             // B
    }

    const postProcessData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            // Animate Scene (Floating effect)
            for (let i = 0; i < MAX_INSTANCES; i++) {
                const base = i * STRIDE;
                sceneData[base + 2] += Math.sin(simTime * 2.0 + i) * 0.05;
            }
            engine.updateBatchData(sceneBatch, sceneData, MAX_INSTANCES);

            // Send Time to Post Process Shader
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