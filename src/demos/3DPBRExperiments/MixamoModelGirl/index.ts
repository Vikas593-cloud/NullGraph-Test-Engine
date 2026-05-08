import { NullGraph, Camera, RenderBatch } from 'null-graph';
import {Animator, GLBParser, SkeletonManager} from "null-graph/loaders";
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";

export async function setupMixamoModel(engine: NullGraph, camera: Camera) {
    const MAX_INSTANCES = 1;
    const STRIDE = 14;

    const mainPass = engine.createPass({ name: 'Mixamo PBR', isMainScreenPass: true });

    // 1. Load the GLB Data
    const glbData = await GLBParser.load('./AnimatedMixamo/BreakDanceGirl.glb');

    if (!glbData.skin || !glbData.animations || glbData.animations.length === 0 || !glbData.meshes) {
        console.error("Missing Skin, Animation, or Mesh data!");
        return;
    }

    // ==========================================
    // 2. INITIALIZE ANIMATION SYSTEMS
    // ==========================================

    // The GPU Bridge: Allocates video memory and handles WebGPU uploads
    const skeletonManager = new SkeletonManager(engine.device, 70);

    // The CPU Math Engine: Crunches the keyframes and matrix multiplications
    const animator = new Animator(glbData.skin);

    // Start playing the first animation immediately
    animator.play(glbData.animations[0]);

    // ==========================================
    // 3. SETUP MESHES & MATERIALS
    // ==========================================

    const characterBatches: RenderBatch[] = [];
    const vbos: GPUBuffer[] = [];
    const ibos: GPUBuffer[] = [];
    const materials: StandardPBRMaterial[] = [];

    for (let i = 0; i < glbData.meshes.length; i++) {
        const meshData = glbData.meshes[i];

        const vertexBuffer = engine.bufferManager.createVertexBuffer(meshData.vertices);
        const indexBuffer = engine.bufferManager.createIndexBuffer(meshData.indices);
        vbos.push(vertexBuffer!);
        ibos.push(indexBuffer!);

        // Determine if this specific mesh part uses bones
        // (If your parser doesn't expose this yet, default to true for Mixamo models)
        const usesBones = meshData.isSkinned;

        // Generate the exact shader code needed for this mesh!
        const dynamicShaderCode = buildPBRShader({
            useSkinning: usesBones
        });

        // Create a specific batch for this mesh part
        const meshBatch = engine.createBatch(mainPass, {
            shaderCode: dynamicShaderCode, // Using our generated string!
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

        const testMaterial = new StandardPBRMaterial(engine, {
            albedoMap: albedoView,
            normalMap: normalView,
            packedMap: pbrView,
            packedMapFormat:"ARM",
            baseColor: [1.0, 1.0, 1.0, 1.0],
            metallicMultiplier: 0.7,  // Very metallic!
            roughnessMultiplier: 1.0  // Very shiny/smooth!
        });
        testMaterial.applyToBatch(meshBatch)
        materials.push(testMaterial)


        // Attach Skeleton Buffer (Group 2) - ONLY if the shader expects it
        if (usesBones) {
            engine.attachCustomBindGroup(
                meshBatch,
                [{ binding: 0, resource: { buffer: skeletonManager.boneBuffer } }],
                2
            );
        }

        engine.setBatchGeometry(meshBatch, vertexBuffer!, indexBuffer!, meshData.indexCount);

        // Position this part in the world
        const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
        initialData[1] = 0; initialData[2] = -3; initialData[3] = 0;
        initialData[8] = 1; initialData[9] = 1; initialData[10] = 1;
        initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0;
        engine.updateBatchData(meshBatch, initialData, MAX_INSTANCES);

        characterBatches.push(meshBatch);
    }

    // Keep track of time for smooth animation updates
    let lastSimTime = 0;

    return {
        update: (simTime: number) => {
            // Calculate delta time (how much time passed since last frame)
            // Assuming simTime is in seconds. If it's in milliseconds, divide by 1000.
            const deltaTime = simTime - lastSimTime;
            lastSimTime = simTime;

            camera.bufferData[19] = simTime;

            // 1. CPU calculates the new bone positions
           // animator.update(deltaTime);

            // 2. GPU is handed the new bone positions
           // skeletonManager.updateFromAnimator(engine.device, animator);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const distance = 11;
            const eye: [number, number, number] = [
                Math.sin(time * 0.5) * distance,
                3,
                Math.cos(time * 0.5) * distance
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            engine.clearPasses();

            // CRITICAL: Clean up GPU memory when destroying the scene!
            skeletonManager.boneBuffer.destroy();

            vbos.forEach(b => b.destroy());
            ibos.forEach(b => b.destroy());
            materials.forEach(m => m.destroy());

        }
    };
}