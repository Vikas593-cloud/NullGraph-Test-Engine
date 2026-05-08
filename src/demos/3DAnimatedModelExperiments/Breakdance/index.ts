import { NullGraph, Camera, RenderBatch } from 'null-graph';
import {Animator, GLBData, GLBParser, SkeletonManager} from 'null-graph/loaders';
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";


export async function setupBreakdanceGirl(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 1;
    const STRIDE = 14;

    const mainPass = engine.createPass({
        name: 'Animated PBR Pass',
        isMainScreenPass: true
    });

    // 1. Load GLB
    const glbData: GLBData = await GLBParser.load('./3dAssets/butterfly.glb');

    if (!glbData.skin || !glbData.animations || glbData.animations.length === 0 || !glbData.meshes) {
        console.error("Missing Skin, Animation, or Mesh data!");
        return;
    }

    // ==========================================
    // 2. INITIALIZE ANIMATION SYSTEMS
    // ==========================================
    const skeletonManager = new SkeletonManager(engine.device, 70);
    const animator = new Animator(glbData.skin);
    animator.play(glbData.animations[0]);

    // ==========================================
    // 3. SETUP MESHES & MATERIALS
    // ==========================================
    const characterBatches: RenderBatch[] = [];
    const vbos: GPUBuffer[] = [];
    const ibos: GPUBuffer[] = [];

    // NEW: Array to track materials for cleanup!
    const materials: StandardPBRMaterial[] = [];

    for (let i = 0; i < glbData.meshes.length; i++) {
        const meshData = glbData.meshes[i];

        const vertexBuffer = engine.bufferManager.createVertexBuffer(meshData.vertices);
        const indexBuffer = engine.bufferManager.createIndexBuffer(meshData.indices);
        vbos.push(vertexBuffer!);
        ibos.push(indexBuffer!);

        const usesBones = meshData.isSkinned ?? true;

        // Generate the dynamic shader code
        const dynamicShaderCode = buildPBRShader({
            useSkinning: usesBones
        });

        // Create the batch
        const meshBatch = engine.createBatch(mainPass, {
            shaderCode: dynamicShaderCode,
            strideFloats: STRIDE,
            maxInstances: MAX_INSTANCES,
            vertexLayouts: meshData.getWebGPULayout(),
            depthWriteEnabled: true
        });

        // Load Textures
        const albedoView = meshData.albedoUrl
            ? await engine.textureManager.load(meshData.albedoUrl, { sRGB: true })
            : engine.textureManager.fallbackWhite;

        const normalView = meshData.normalUrl
            ? await engine.textureManager.load(meshData.normalUrl, { sRGB: false })
            : engine.textureManager.fallbackNormal;

        const pbrView = meshData.metallicRoughnessUrl
            ? await engine.textureManager.load(meshData.metallicRoughnessUrl, { sRGB: false })
            : engine.textureManager.fallbackWhite;

        // Create the high-level Material
        const testMaterial = new StandardPBRMaterial(engine, {
            albedoMap: albedoView,
            normalMap: normalView,
            packedMap: pbrView,
            packedMapFormat: "ARM",
            baseColor: [1.0, 1.0, 1.0, 1.0],
            metallicMultiplier: 0.7,
            roughnessMultiplier: 1.0
        });

        // Apply it and track it!
        testMaterial.applyToBatch(meshBatch);
        materials.push(testMaterial);

        // Attach Skeleton Buffer (Group 2)
        if (usesBones) {
            engine.attachCustomBindGroup(
                meshBatch,
                [{ binding: 0, resource: { buffer: skeletonManager.boneBuffer } }],
                2
            );
        }

        engine.setBatchGeometry(meshBatch, vertexBuffer!, indexBuffer!, meshData.indexCount);

        // Position this part
        const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
        initialData[1] = 0; initialData[2] = -3; initialData[3] = 0;
        initialData[8] = 1; initialData[9] = 1; initialData[10] = 1;
        initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0;
        engine.updateBatchData(meshBatch, initialData, MAX_INSTANCES);

        characterBatches.push(meshBatch);
    }

    let isDestroyed = false;
    let lastTime = 0;

    return {
        update: (simTime: number) => {
            if (isDestroyed) return;

            const now = performance.now();
            const deltaTime = lastTime === 0 ? 0.016 : (now - lastTime) / 1000;
            lastTime = now;

            // 1. CPU computes the bones ONCE
            animator.update(deltaTime);

            // 2. GPU gets the bones ONCE via the SkeletonManager
            skeletonManager.updateFromAnimator(engine.device, animator);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const distance = 11;
            const eye: [number, number, number] = [
                Math.sin(time * 0.1) * distance,
                3,
                Math.cos(time * 0.1) * distance
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            isDestroyed = true;

            // Cleanup GPU memory!
            skeletonManager.boneBuffer.destroy();
            vbos.forEach(b => b.destroy());
            ibos.forEach(b => b.destroy());
            materials.forEach(m => m.destroy()); // Material uniform buffers cleaned up!

            engine.clearPasses();

            if (glbData.imageUrls) {
                glbData.imageUrls.forEach(url => URL.revokeObjectURL(url));
            }
        }
    };
}