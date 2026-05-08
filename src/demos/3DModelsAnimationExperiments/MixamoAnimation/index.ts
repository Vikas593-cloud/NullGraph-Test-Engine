import { NullGraph, Camera } from 'null-graph';
import {  StandardPBRMaterial } from 'null-graph/materials';
import { GLBParser, Animator } from "null-graph/loaders";

export async function setupMixamoCharacterAnimationDemo(engine: NullGraph, camera: Camera) {
    const mainPass = engine.createPass({
        name: 'Mixamo Animation Test',
        isMainScreenPass: true
    });

    // 1. Load the GLB (Parser now grabs nodes, skins, and animations)
    const characterMesh = await GLBParser.load('./3dAssets/mixamo_dancing.glb');

    if(!characterMesh.meshes){
        return ;
    }
    // 2. Create the Vertex/Index Buffers
    const vertexBuffer = engine.bufferManager.createVertexBuffer(characterMesh.meshes[0].vertices);
    const indexBuffer = engine.bufferManager.createIndexBuffer(characterMesh.meshes[0].indices);

    // 3. Updated Layout: Stride is now 48 bytes (32 for standard + 16 for anim)
    const skinnedVertexLayout: GPUVertexBufferLayout[] = [{
        arrayStride: 48,
        attributes: [
            { format: 'float32x3', offset: 0,  shaderLocation: 0 }, // Pos
            { format: 'float32x3', offset: 12, shaderLocation: 1 }, // Normal
            { format: 'float32x2', offset: 24, shaderLocation: 2 }, // UV
            { format: 'uint16x4',  offset: 32, shaderLocation: 3 }, // Joints (4x 2-byte ints)
            { format: 'float32x4', offset: 40, shaderLocation: 4 }  // Weights (4x 4-byte floats)
        ]
    }];

    // 4. Initialize the Animator (Handles the DOD glTF math)
    // We pass it the skeleton/skin data so it knows the bind poses
    const animator = new Animator(glbData.skeleton);
    const danceAnimation = glbData.animations.find(a => a.name === 'Dance');
    animator.play(danceAnimation);

    // 5. Create a GPU Buffer specifically for this character's bones
    const MAX_BONES = 70;
    const boneUniformBuffer = engine.device.createBuffer({
        size: MAX_BONES * 16 * 4, // 70 matrices * 16 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // 6. Setup Material and Batch
    const testMaterial = new StandardPBRMaterial(engine, { /* your textures */ });

    const batch = engine.createBatch(mainPass, {
        shaderCode: SkinnedPBRShaderCode,
        material: testMaterial,
        strideFloats: 1,
        maxInstances: 1,
        vertexLayouts: skinnedVertexLayout,
    });

    engine.setBatchGeometry(batch, vertexBuffer!, indexBuffer!, characterMesh.indexCount);

    return {
        update: (simTime: number, deltaTime: number) => {
            // A. Update the CPU-side skeleton (interpolates tracks, computes global matrices)
            animator.update(deltaTime);

            // B. Get the final skinning matrices (Global Transform * Inverse Bind Matrix)
            const skinningMatrices = animator.getSkinningMatrices();

            // C. Upload the flat Float32Array of matrices directly to the GPU
            engine.device.queue.writeBuffer(
                boneUniformBuffer,
                0,
                skinningMatrices.buffer,
                skinningMatrices.byteOffset,
                skinningMatrices.byteLength
            );
        },
        destroy: () => {
            boneUniformBuffer.destroy();
            testMaterial.destroy();
            engine.clearPasses();
        }
    };
}