import { Camera, NullGraph } from "null-graph";
import { cubeIndices, cubeVertices } from "../data";

export async function setupForwardLightingCyberPunk2077(
    engine: NullGraph,
    camera: Camera,
    getUiState: () => { amplitude: number }
) {
    const MAX_INSTANCES = 10000;
    const NUM_LIGHTS = 100;
    const TILE_SIZE = 16;
    const canvasWidth = engine.device.limits.maxTextureDimension2D; // Or your canvas width
    const canvasHeight = engine.device.limits.maxTextureDimension2D; // Or your canvas height
    // Note: For a real app, pass the actual canvas width/height here!
    const SCREEN_W = 1920;
    const SCREEN_H = 1080;

    // 1. Setup Geometry
    const cvo = engine.bufferManager.createVertexBuffer(cubeVertices);
    const cio = engine.bufferManager.createIndexBuffer(cubeIndices);

    // 2. Create the Buffers
    const configBuffer = engine.device.createBuffer({
        size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Write config once: [screenWidth, screenHeight, tileSize, numLights]
    engine.device.queue.writeBuffer(configBuffer, 0, new Float32Array([SCREEN_W, SCREEN_H, TILE_SIZE, 0]));
    engine.device.queue.writeBuffer(configBuffer, 12, new Uint32Array([NUM_LIGHTS])); // write uint at byte 12

    const lightsBuffer = engine.device.createBuffer({
        size: NUM_LIGHTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const maxTilesX = Math.ceil(SCREEN_W / TILE_SIZE);
    const maxTilesY = Math.ceil(SCREEN_H / TILE_SIZE);
    const tileIndicesBuffer = engine.device.createBuffer({
        size: maxTilesX * maxTilesY * 260, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // ---------------------------------------------------------
    // 1. THE COMPUTE SHADER (Has read_write permission)
    // ---------------------------------------------------------
    const computeShaderCode = `
        struct CameraUniform {
            viewProj: mat4x4<f32>,
            position: vec3<f32>,
            padding: f32,
        };
        struct Light { position: vec3<f32>, radius: f32, color: vec3<f32>, padding: f32 };
        struct ForwardPlusConfig { screenDimensions: vec2<f32>, tileSize: vec2<f32>, numLights: u32 };

        @group(0) @binding(0) var<uniform> camera: CameraUniform;
        // Compute doesn't need the instance buffer, so we skip group 0 binding 1

        @group(1) @binding(0) var<uniform> config: ForwardPlusConfig;
        @group(1) @binding(1) var<storage, read> allLights: array<Light>;
        @group(1) @binding(2) var<storage, read_write> tileLightIndices: array<u32>; // READ_WRITE IS OK HERE

        fn checkIntersection(light: Light, tileXY: vec2<f32>) -> bool {
            let clipPos = camera.viewProj * vec4<f32>(light.position, 1.0);
            if (clipPos.w <= 0.0) { return false; } 
            
            let ndc = clipPos.xy / clipPos.w;
            let screenSpacePos = (ndc * 0.5 + 0.5) * config.screenDimensions;
            let finalScreenPos = vec2<f32>(screenSpacePos.x, config.screenDimensions.y - screenSpacePos.y);

            let tileMin = tileXY * config.tileSize;
            let tileMax = tileMin + config.tileSize;
            let screenRadius = (light.radius / clipPos.w) * config.screenDimensions.x * 0.5;

            let closestX = clamp(finalScreenPos.x, tileMin.x, tileMax.x);
            let closestY = clamp(finalScreenPos.y, tileMin.y, tileMax.y);
            let distanceX = finalScreenPos.x - closestX;
            let distanceY = finalScreenPos.y - closestY;
            
            return (distanceX * distanceX + distanceY * distanceY) < (screenRadius * screenRadius);
        }

        @compute @workgroup_size(16, 16, 1)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            if (f32(global_id.x) >= (config.screenDimensions.x / config.tileSize.x) || 
                f32(global_id.y) >= (config.screenDimensions.y / config.tileSize.y)) {
                return;
            }

            let tilesPerRow = u32(config.screenDimensions.x / config.tileSize.x);
            let tileIndex = global_id.y * tilesPerRow + global_id.x;
            let baseMemoryOffset = tileIndex * 65u; 
            var lightCount: u32 = 0u;

            for (var i: u32 = 0u; i < config.numLights; i++) {
                let light = allLights[i];
                if (checkIntersection(light, vec2<f32>(global_id.xy)) && lightCount < 64u) {
                    tileLightIndices[baseMemoryOffset + 1u + lightCount] = i;
                    lightCount++;
                }
            }
            tileLightIndices[baseMemoryOffset] = lightCount;
        }
    `;

    // ---------------------------------------------------------
    // 2. THE RENDER SHADER (Read-only buffers + Instance Data)
    // ---------------------------------------------------------
    const renderShaderCode = `
        struct CameraUniform {
            viewProj: mat4x4<f32>,
            position: vec3<f32>,
            padding: f32,
        };
        struct Light { position: vec3<f32>, radius: f32, color: vec3<f32>, padding: f32 };
        struct ForwardPlusConfig { screenDimensions: vec2<f32>, tileSize: vec2<f32>, numLights: u32 };

        @group(0) @binding(0) var<uniform> camera: CameraUniform;
        // REQUIRED BY NULLGRAPH: We must declare the instance buffer here!
        @group(0) @binding(1) var<storage, read> instances: array<mat4x4<f32>>; 

        @group(1) @binding(0) var<uniform> config: ForwardPlusConfig;
        @group(1) @binding(1) var<storage, read> allLights: array<Light>;
        @group(1) @binding(2) var<storage, read> tileLightIndices: array<u32>; // MUST BE READ ONLY IN FRAGMENT!

        struct VertexInput {
            @location(0) position: vec3<f32>,
        };

        struct VertexOutput {
            @builtin(position) clip_position: vec4<f32>,
            @location(0) worldPosition: vec3<f32>,
        };

        @vertex
        fn vs_main(model: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
            var out: VertexOutput;
            // Grab this specific cube's 3D transform matrix from the engine
            let transform = instances[instanceIdx]; 
            let worldPos = transform * vec4<f32>(model.position, 1.0);
            
            out.worldPosition = worldPos.xyz;
            out.clip_position = camera.viewProj * worldPos;
            return out;
        }

        @fragment
        fn fs_main(@builtin(position) fragCoord: vec4<f32>, in: VertexOutput) -> @location(0) vec4<f32> {
            let tileX = u32(fragCoord.x / config.tileSize.x);
            let tileY = u32(fragCoord.y / config.tileSize.y);
            let tilesPerRow = u32(config.screenDimensions.x / config.tileSize.x);
            let tileIndex = tileY * tilesPerRow + tileX;

            let baseMemoryOffset = tileIndex * 65u;
            let lightCountForThisTile = tileLightIndices[baseMemoryOffset];

            var finalColor = vec3<f32>(0.05, 0.05, 0.1); 

            for (var i: u32 = 0u; i < lightCountForThisTile; i++) {
                let lightIndex = tileLightIndices[baseMemoryOffset + 1u + i];
                let light = allLights[lightIndex];
                
                let distance = length(light.position - in.worldPosition);
                if (distance < light.radius) {
                    let attenuation = 1.0 - (distance / light.radius);
                    finalColor += light.color * attenuation * 2.0; 
                }
            }

            return vec4<f32>(finalColor, 1.0);
        }
    `;

    const mainPass = engine.createPass({
        name: 'ForWardLighting Main Pass',
        isMainScreenPass: true
    });
    // 4. Create the Custom Compute Pipeline for Lighting
    // Compile Compute Pipeline
    const computeShaderModule = engine.device.createShaderModule({ code: computeShaderCode });
    const computePipeline = engine.device.createComputePipeline({
        layout: 'auto',
        compute: { module: computeShaderModule, entryPoint: 'cs_main' }
    });

    // Create Render Batch
    const batch = engine.createBatch(mainPass,{
        shaderCode: renderShaderCode, // Use the Render string here!
        strideFloats: 16,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: [{
            arrayStride: 3 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
    });
    engine.setBatchGeometry(batch, cvo, cio, cubeIndices.length);

    // 6. Connect the Bind Groups
    const forwardPlusBindGroup = engine.attachCustomBindGroup(batch, [
        { binding: 0, resource: { buffer: configBuffer } },
        { binding: 1, resource: { buffer: lightsBuffer } },
        { binding: 2, resource: { buffer: tileIndicesBuffer } }
    ]);

    // We also need a bind group for the Compute pass (it needs the Camera at group 0, and the Forward config at group 1)
    const computeCameraBindGroup = engine.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: (engine as any).cameraUniformBuffer } }]
    });

    const instanceData = new Float32Array(MAX_INSTANCES * 16);
    const lightData = new Float32Array(NUM_LIGHTS * 8);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // 1. Manually run the Light Culling Compute Pass
            const commandEncoder = engine.device.createCommandEncoder();
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(computePipeline);
            computePass.setBindGroup(0, computeCameraBindGroup);
            computePass.setBindGroup(1, forwardPlusBindGroup);
            // Dispatch enough threads to cover the screen
            computePass.dispatchWorkgroups(maxTilesX, maxTilesY, 1);
            computePass.end();
            engine.device.queue.submit([commandEncoder.finish()]);

            // 2. Update engine data and render normally
            engine.updateBatchData(batch, instanceData, MAX_INSTANCES);
        },
        destroy: () => {
            configBuffer.destroy();
            lightsBuffer.destroy();
            tileIndicesBuffer.destroy();
            engine.clearPasses();
        }
    };
}