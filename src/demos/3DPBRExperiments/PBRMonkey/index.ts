import { NullGraph, Camera } from 'null-graph';
import {buildPBRShader, PBRShaderCode, StandardPBRMaterial} from 'null-graph/materials';
import {GLBParser} from "null-graph/loaders";


export async function setupPBRTest(engine: NullGraph, camera: Camera) {
    const MAX_INSTANCES = 1;
    const STRIDE = 14;

    const mainPass = engine.createPass({ name: 'PBR Test', isMainScreenPass: true });

    // 1. Load Textures (Replace these paths with the ones you downloaded!)
    // CRITICAL: Albedo is sRGB: true. Normal is sRGB: false!
    const albedoView = await engine.textureManager.load('./textures/rusty_metal_04_diff_1k.png', { sRGB: true });
    const normalView = await engine.textureManager.load('./textures/rusty_metal_04_nor_gl_1k.png', { sRGB: false });
    const packedView = await engine.textureManager.load('./textures/rusty_metal_04_arm_1k.png', { sRGB: false });

    // 2. Create the Material
    const testMaterial = new StandardPBRMaterial(engine, {
        albedoMap: albedoView,
        normalMap: normalView,
        packedMap: packedView,
        packedMapFormat:"ARM",
        baseColor: [1.0, 1.0, 1.0, 1.0],
        metallicMultiplier: 0.7,  // Very metallic!
        roughnessMultiplier: 0.4  // Very shiny/smooth!
    });




    const glbData = await GLBParser.load('./3dAssets/monkey.glb');


    if (!glbData.meshes) {
       return;
    }
    const monkeyMesh=glbData.meshes[0]
    const vertexBuffer = engine.bufferManager.createVertexBuffer(monkeyMesh.vertices);
    const indexBuffer = engine.bufferManager.createIndexBuffer(monkeyMesh.indices);

    const hasBones = monkeyMesh.isSkinned;

    // 2. Generate the perfect shader for this specific mesh
    const finalShaderCode = buildPBRShader({
        useSkinning: hasBones
    });

    // 3. Create the batch using the dynamically generated code
    const pbrBatch = engine.createBatch(mainPass, {
        shaderCode: finalShaderCode,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: monkeyMesh.getWebGPULayout(),
        depthWriteEnabled: true
    });
    testMaterial.applyToBatch(pbrBatch)

    engine.setBatchGeometry(pbrBatch, vertexBuffer!, indexBuffer!, monkeyMesh.indexCount);

    // 5. ECS Data Setup (Position at center)
    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    initialData[1] = 0; initialData[2] = 0; initialData[3] = 0; // X, Y, Z
    initialData[8] = 3; initialData[9] =3; initialData[10] =3; // Scale X, Y, Z
    engine.updateBatchData(pbrBatch, initialData, MAX_INSTANCES);

    return {
        update: (simTime: number) => {
            // Update time for the camera (if needed)
            camera.bufferData[19] = simTime;
        },
        cameraUpdate: (cam: Camera, time: number) => {
            // Slowly orbit the camera around the sphere so we can watch
            // the specular highlights glide across the normal map bumps!
            const distance = 5;
            const eye: [number, number, number] = [
                Math.sin(time * 0.5) * distance,
                3, // Slightly elevated angle
                Math.cos(time * 0.5) * distance
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            testMaterial.destroy();
            engine.clearPasses();
        }
    };
}