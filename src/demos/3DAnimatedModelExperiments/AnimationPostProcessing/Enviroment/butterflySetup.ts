import {Primitives, StandardLayout} from "null-graph/geometry";
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";
import {Camera, NullGraph, RenderBatch, RenderPassNode} from "null-graph";
import {Animator, GLBParser, SkeletonManager} from "null-graph/loaders";
import {butterflyComputeShader, butterflyRenderShader} from "./shader";

export async function setupButterfly(engine: NullGraph, targetPass: RenderPassNode, glbUrl: string,camera:Camera) {
    const MAX_INSTANCES = 2000;
    const STRIDE = 20;

    const glbData = await GLBParser.load(glbUrl);
    if (!glbData.skin || !glbData.animations || glbData.animations.length === 0 || !glbData.meshes) {
        console.error("Missing Skin, Animation, or Mesh data!");
        return;
    }

    const vbos: GPUBuffer[] = [];
    const ibos: GPUBuffer[] = [];
    const materials: StandardPBRMaterial[] = [];
    const butterflyBatches: RenderBatch[] = [];

    const skeletonManager = new SkeletonManager(engine.device, 70);
    const animator = new Animator(glbData.skin);
    animator.play(glbData.animations[0]);
    console.log(glbData)

    for (let i = 0; i < glbData.meshes.length; i++) {
        const meshData = glbData.meshes[i];

        const vertexBuffer = engine.bufferManager.createVertexBuffer(meshData.vertices);
        const indexBuffer = engine.bufferManager.createIndexBuffer(meshData.indices);
        vbos.push(vertexBuffer!);
        ibos.push(indexBuffer!);

        const usesBones = meshData.isSkinned ?? false;

        const meshBatch = engine.createBatch(targetPass, {
            computeShaderCode: butterflyComputeShader, // Add the compute shader
            shaderCode: butterflyRenderShader,
            isIndirect:true,
            strideFloats: STRIDE,
            maxInstances: MAX_INSTANCES,
            vertexLayouts: meshData.getWebGPULayout(),
            depthWriteEnabled: true,
            targetFormat: 'rgba16float'
        });

        // Load textures if the butterfly has them, otherwise use fallbacks
        const albedoView = meshData.albedoUrl ? await engine.textureManager.load(meshData.albedoUrl, { sRGB: true }) : engine.textureManager.fallbackWhite;
        const normalView = meshData.normalUrl ? await engine.textureManager.load(meshData.normalUrl, { sRGB: false }) : engine.textureManager.fallbackNormal;
        const pbrView = meshData.metallicRoughnessUrl ? await engine.textureManager.load(meshData.metallicRoughnessUrl, { sRGB: false }) : engine.textureManager.fallbackWhite;

        const material = new StandardPBRMaterial(engine, {
            albedoMap: albedoView,
            normalMap: normalView,
            packedMap: pbrView,
            packedMapFormat: "ARM",
            baseColor: [1.0, 1.0, 1.0, 1.0]
        });

        material.applyToBatch(meshBatch);
        materials.push(material);
        const initialDrawArgs = new Uint32Array([meshData.indexCount, 0, 0, 0, 0]);
        engine.device.queue.writeBuffer(meshBatch.indirectBuffer!, 0, initialDrawArgs);

        engine.setBatchGeometry(meshBatch, vertexBuffer!, indexBuffer!, meshData.indexCount);
        if (usesBones) {
            engine.attachCustomBindGroup(
                meshBatch,
                [{ binding: 0, resource: { buffer: skeletonManager.boneBuffer } }],
                2 // Group 2!
            );
        }
        meshBatch.computeCustomBindGroups =[];

        const initialData = new Float32Array(MAX_INSTANCES * STRIDE);

        for (let i = 0; i < MAX_INSTANCES; i++) {
            const base = i * STRIDE;

            // 1. FREE VOLUME SPAWNING (100x100 area)
            // Randomly place them between -50 and +50 on X and Z
            const startX = (Math.random() - 0.5) * 100.0;
            const startZ = (Math.random() - 0.5) * 100.0;
            const height = -4.0 + (Math.random() * 40.0);

            initialData[base + 0] = Math.random(); // seed

            // Set Position
            initialData[base + 1] = startX;
            initialData[base + 2] = height;
            initialData[base + 3] = startZ;

            initialData[base + 4] = 0.0; initialData[base + 5] = 0.0;
            initialData[base + 6] = 0.0; initialData[base + 7] = 1.0;

            const scale = 0.3+ Math.random() * 0.4;
            initialData[base + 8] = scale; initialData[base + 9] = scale; initialData[base + 10] = scale;

            // 2. SLOW WANDERING VELOCITY
            // Give them a tiny random starting push in any direction
            initialData[base + 11] = (Math.random() - 0.5) * 0.5;
            initialData[base + 12] = (Math.random() - 0.5) * 0.1;
            initialData[base + 13] = (Math.random() - 0.5) * 0.5;

            // [14, 15, 16] Random Epic Colors!
            const colorMix = Math.random();
            if (colorMix < 0.33) {
                initialData[base + 14] = 0.1; initialData[base + 15] = 0.8; initialData[base + 16] = 1.0; // Cyan
            } else if (colorMix < 0.66) {
                initialData[base + 14] = 0.9; initialData[base + 15] = 0.1; initialData[base + 16] = 0.8; // Magenta
            } else {
                initialData[base + 14] = 0.4; initialData[base + 15] = 0.2; initialData[base + 16] = 1.0; // Deep Violet
            }
        }
        engine.updateBatchData(meshBatch, initialData, MAX_INSTANCES);
        butterflyBatches.push(meshBatch);
    }
    let lastTime = 0;

    return {
        update: (simTime: number) => {

            const now = performance.now();
            const deltaTime = lastTime === 0 ? 0.016 : (now - lastTime) / 1000;
            lastTime = now;
            camera.bufferData[19] = simTime;

            // 1. CPU computes the bones ONCE
            animator.update(deltaTime);

            // 2. GPU gets the bones ONCE via the SkeletonManager
            skeletonManager.updateFromAnimator(engine.device, animator);
        },
        destroy: () => {
            materials.forEach(m => m.destroy());
            vbos.forEach(b => b.destroy());
            ibos.forEach(b => b.destroy());
            skeletonManager.boneBuffer.destroy();
            GLBParser.disposeImages(glbData)
        }
    };
}
// magical Neons (Cyan, Magenta, Violet)
// const colorMix = Math.random();
//             if (colorMix < 0.33) {
//                 initialData[base + 14] = 0.1; initialData[base + 15] = 0.8; initialData[base + 16] = 1.0; // Cyan
//             } else if (colorMix < 0.66) {
//                 initialData[base + 14] = 0.9; initialData[base + 15] = 0.1; initialData[base + 16] = 0.8; // Magenta
//             } else {
//                 initialData[base + 14] = 0.4; initialData[base + 15] = 0.2; initialData[base + 16] = 1.0; // Deep Violet
//             }

// fire and lava
// const colorMix = Math.random();
// if (colorMix < 0.45) {
//     initialData[base + 14] = 1.0; initialData[base + 15] = 0.4; initialData[base + 16] = 0.0; // Bright Ember Orange
// } else if (colorMix < 0.85) {
//     initialData[base + 14] = 0.8; initialData[base + 15] = 0.05; initialData[base + 16] = 0.05; // Deep Crimson Red
// } else {
//     initialData[base + 14] = 0.3; initialData[base + 15] = 0.1; initialData[base + 16] = 0.4; // Smoky Dark Violet
// }

// green
// const colorMix = Math.random();
// if (colorMix < 0.4) {
//     initialData[base + 14] = 0.1; initialData[base + 15] = 1.0; initialData[base + 16] = 0.2; // Neon Flora Green
// } else if (colorMix < 0.8) {
//     initialData[base + 14] = 0.0; initialData[base + 15] = 0.8; initialData[base + 16] = 0.8; // Bioluminescent Teal
// } else {
//     initialData[base + 14] = 0.8; initialData[base + 15] = 1.0; initialData[base + 16] = 0.1; // Glowing Spore Yellow
// }

// icy
//const colorMix = Math.random();
// if (colorMix < 0.5) {
//     initialData[base + 14] = 0.6; initialData[base + 15] = 0.9; initialData[base + 16] = 1.0; // Ice Frost Blue
// } else if (colorMix < 0.8) {
//     initialData[base + 14] = 0.05; initialData[base + 15] = 0.1; initialData[base + 16] = 0.8; // Deep Void Blue
// } else {
//     initialData[base + 14] = 0.9; initialData[base + 15] = 0.9; initialData[base + 16] = 1.0; // Piercing Ghost White
// }


// golden hour
//const colorMix = Math.random();
// if (colorMix < 0.4) {
//     initialData[base + 14] = 1.0; initialData[base + 15] = 0.8; initialData[base + 16] = 0.2; // Warm Sunlight Gold
// } else if (colorMix < 0.7) {
//     initialData[base + 14] = 1.0; initialData[base + 15] = 0.5; initialData[base + 16] = 0.3; // Peach / Coral
// } else {
//     initialData[base + 14] = 0.9; initialData[base + 15] = 0.6; initialData[base + 16] = 0.8; // Soft Sunset Pink
// }