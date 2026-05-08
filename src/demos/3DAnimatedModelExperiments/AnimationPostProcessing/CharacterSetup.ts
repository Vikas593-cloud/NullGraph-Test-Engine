import { NullGraph, RenderBatch, RenderPassNode } from 'null-graph';
import {Animator, GLBData, GLBParser, SkeletonManager} from 'null-graph/loaders';
import { emissiveHairShader } from "./shaders";
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";


export async function loadAnimatedCharacter(engine: NullGraph, targetPass: RenderPassNode, url: string) {
    const glbData: GLBData = await GLBParser.load(url);

    if (!glbData.skin || !glbData.animations || glbData.animations.length === 0 || !glbData.meshes) {
        throw new Error("Missing Skin, Animation, or Mesh data!");
    }

    // ==========================================
    // 1. INITIALIZE ANIMATION SYSTEMS
    // ==========================================
    const animator = new Animator(glbData.skin);
    animator.play(glbData.animations[0]);

    // Our new GPU bridge handles the buffer allocation!
    const skeletonManager = new SkeletonManager(engine.device, 70);

    // ==========================================
    // 2. SETUP MESHES & MATERIALS
    // ==========================================
    const vbos: GPUBuffer[] = [];
    const ibos: GPUBuffer[] = [];
    const characterBatches: RenderBatch[] = [];
    const materials: StandardPBRMaterial[] = []; // Track materials to prevent uniform buffer memory leaks!

    let hairBatch: RenderBatch | null = null;
    let hairDataArray: Float32Array | null = null;

    for (let i = 0; i < glbData.meshes.length; i++) {
        const meshData = glbData.meshes[i];

        const vertexBuffer = engine.bufferManager.createVertexBuffer(meshData.vertices);
        const indexBuffer = engine.bufferManager.createIndexBuffer(meshData.indices);
        vbos.push(vertexBuffer!);
        ibos.push(indexBuffer!);

        const isHair = (i === 1);
        const usesBones = meshData.isSkinned ?? true;

        // Use custom hair shader OR dynamically build the body shader
        const shaderToUse = isHair
            ? emissiveHairShader
            : buildPBRShader({ useSkinning: usesBones });

        const meshBatch = engine.createBatch(targetPass, {
            shaderCode: shaderToUse,
            strideFloats: 14,
            maxInstances: 1,
            vertexLayouts: meshData.getWebGPULayout(),
            depthWriteEnabled: true,
            targetFormat: 'rgba16float'
        });

        // Load Textures
        const albedoView = meshData.albedoUrl ? await engine.textureManager.load(meshData.albedoUrl, { sRGB: true }) : engine.textureManager.fallbackWhite;
        const normalView = meshData.normalUrl ? await engine.textureManager.load(meshData.normalUrl, { sRGB: false }) : engine.textureManager.fallbackNormal;
        const pbrView = meshData.metallicRoughnessUrl ? await engine.textureManager.load(meshData.metallicRoughnessUrl, { sRGB: false }) : engine.textureManager.fallbackWhite;

        // Use our high-level Material class!
        const material = new StandardPBRMaterial(engine, {
            albedoMap: albedoView,
            normalMap: normalView,
            packedMap: pbrView,
            packedMapFormat: "ARM",
            baseColor: [1.0, 1.0, 1.0, 1.0]
        });

        material.applyToBatch(meshBatch);
        materials.push(material); // Save for cleanup

        // Attach bones ONLY if the mesh needs them
        if (usesBones) {
            engine.attachCustomBindGroup(
                meshBatch,
                [{ binding: 0, resource: { buffer: skeletonManager.boneBuffer } }],
                2
            );
        }

        engine.setBatchGeometry(meshBatch, vertexBuffer!, indexBuffer!, meshData.indexCount);

        // ECS Data / Uniforms
        const initialData = new Float32Array(14);
        initialData[1] = 0; initialData[2] = -4; initialData[3] = 0; // Position
        initialData[8] = 1; initialData[9] = 1;  initialData[10] = 1; // Scale

        if (isHair) {
            initialData[11] = 30.0; // Default Red (R)
            initialData[12] = 0.0;  // G
            initialData[13] = 5.0;  // B
            hairBatch = meshBatch;
            hairDataArray = initialData;
        } else {
            initialData[11] = 30.0;
            initialData[12] = 0.0;
            initialData[13] = 5.0;
        }

        engine.updateBatchData(meshBatch, initialData, 1);
        characterBatches.push(meshBatch);
    }

    return {
        animator,
        // We expose the skeleton manager now so you can access the buffer if needed
        skeletonManager,

        updateBones: (deltaTime: number) => {
            // 1. CPU computes math
            animator.update(deltaTime);
            // 2. GPU uploads math (No more manual writeBuffer logic here!)
            skeletonManager.updateFromAnimator(engine.device, animator);
        },

        updateHairColor: (r: number, g: number, b: number) => {
            if (hairBatch && hairDataArray) {
                hairDataArray[11] = r;
                hairDataArray[12] = g;
                hairDataArray[13] = b;
                engine.updateBatchData(hairBatch, hairDataArray, 1);
            }
        },

        destroy: () => {
            // 1. Clean up Engine/GPU memory
            skeletonManager.boneBuffer.destroy();
            materials.forEach(m => m.destroy());
            vbos.forEach(b => b.destroy());
            ibos.forEach(b => b.destroy());
            GLBParser.disposeImages(glbData)
        }
    };
}