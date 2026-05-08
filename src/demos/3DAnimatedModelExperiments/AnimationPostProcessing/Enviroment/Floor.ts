import {Primitives, StandardLayout} from "null-graph/geometry";
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";
import {Camera, NullGraph, RenderBatch, RenderPassNode} from "null-graph";
import {GLBParser} from "null-graph/loaders";


export async function setupFloor(engine: NullGraph, targetPass: RenderPassNode) {
    const MAX_INSTANCES = 1;
    const STRIDE = 14;

    const floorGeom = Primitives.createPlane(StandardLayout, 100, 100);
    floorGeom.upload(engine);
    const albedoView = await engine.textureManager.load('./textures/moon_01_diff_1k.jpg', { sRGB: true });
    const normalView = await engine.textureManager.load('./textures/moon_01_nor_gl_1k.jpg', { sRGB: false });
    const packedView = await engine.textureManager.load('./textures/moon_01_arm_1k.jpg', { sRGB: false });


    const floorMaterial = new StandardPBRMaterial(engine, {
        albedoMap: albedoView,
        normalMap: normalView,
        packedMap: packedView,
        packedMapFormat: "ARM",
        baseColor: [1.0, 1.0, 1.0, 1.0],
        metallicMultiplier: 0.1,
        roughnessMultiplier: 0.1
    });

    const floorBatch = engine.createBatch(targetPass, {
        shaderCode: buildPBRShader({ useSkinning: false }),
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        vertexLayouts: floorGeom.layout.getWebGPUDescriptor(),
        depthWriteEnabled: true,
        targetFormat: 'rgba16float'
    });

    floorMaterial.applyToBatch(floorBatch);
    engine.setBatchGeometry(floorBatch, floorGeom.vertexBuffer!, floorGeom.indexBuffer!, floorGeom.indices.length);

    const initialData = new Float32Array(STRIDE);

    // Position (Below character)
    initialData[1] = 0.0;  // X
    initialData[2] = -4.1; // Y
    initialData[3] = 0.0;  // Z

    // Rotation (-90 degrees on X to lay flat)
    initialData[4] = Math.sin(-Math.PI / 4); // Rot X
    initialData[5] = 0.0;                    // Rot Y
    initialData[6] = 0.0;                    // Rot Z
    initialData[7] = Math.cos(-Math.PI / 4); // Rot W

    // Scale
    initialData[8] = 1.0; initialData[9] = 1.0; initialData[10] = 1.0;

    // Color (Dark Teal)
    initialData[11] = 0.05; initialData[12] = 0.2; initialData[13] = 0.3;

    engine.updateBatchData(floorBatch, initialData, MAX_INSTANCES);

    return {
        update: (simTime: number) => { /* Floor is static */ },
        destroy: () => {
            floorMaterial.destroy();
            floorGeom.destroy();
        }
    };
}