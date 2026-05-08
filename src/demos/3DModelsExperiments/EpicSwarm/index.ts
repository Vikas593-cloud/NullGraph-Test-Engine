import { NullGraph, Camera } from 'null-graph';
import { GLBParser } from 'null-graph/loaders';
import { epicComputeShader, epicRenderShader } from './shaders';
import { halationScatteringPostProcess } from './postProcessShaders';

export async function setupEpicSwarm(engine: NullGraph, camera: Camera) {
    const MAX_INSTANCES = 8000;
    const STRIDE = 14;

    const glbData = await GLBParser.load('/3dAssets/monkey.glb');
    if ( !glbData.meshes) {
        console.error("Missing  Mesh data!");
        return;
    }
    const monkeyMesh = glbData.meshes[0];
    const vertexBuffer = engine.bufferManager.createVertexBuffer(monkeyMesh.vertices);
    const indexBuffer = engine.bufferManager.createIndexBuffer(monkeyMesh.indices);

    const resolution = [2048, 2048];
    const offscreenTexture = engine.device.createTexture({
        size: resolution, format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    const offscreenDepth = engine.device.createTexture({
        size: resolution, format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const sampler = engine.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const swarmPass = engine.createPass({
        name: 'Epic Swarm Pass',
        isMainScreenPass: false,
        colorAttachments: [{
            view: offscreenTexture.createView(),
            clearValue: { r: 0.002, g: 0.002, b: 0.01, a: 1.0 },
            loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: offscreenDepth.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
        }
    });

    const swarmBatch = engine.createBatch(swarmPass, {
        isIndirect: true,
        computeShaderCode: epicComputeShader,
        shaderCode: epicRenderShader,
        strideFloats: STRIDE,
        maxInstances: MAX_INSTANCES,
        targetFormat: 'rgba16float',
        vertexLayouts: monkeyMesh.getWebGPULayout(),
        depthWriteEnabled: true,
        depthCompare: 'less'
    });

    engine.setBatchGeometry(swarmBatch, vertexBuffer, indexBuffer, monkeyMesh.indexCount);
    const initialDrawArgs = new Uint32Array([monkeyMesh.indexCount, 0, 0, 0, 0]);
    engine.device.queue.writeBuffer(swarmBatch.indirectBuffer!, 0, initialDrawArgs);

    const postPass = engine.createPass({ name: 'Epic Post Process', isMainScreenPass: true });
    const postBatch = engine.createBatch(postPass, {
        shaderCode: halationScatteringPostProcess, strideFloats: 1, maxInstances: 1
    });
    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    const initialData = new Float32Array(MAX_INSTANCES * STRIDE);
    const arms = 5;

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Pushed way further out (up to 450 units away)
        const distance = 40 + (Math.random() * 450);
        const armOffset = (i % arms) * ((Math.PI * 2) / arms);

        const angle = armOffset + (distance * 0.05) + (Math.random() * 0.8);
        const verticalSpread = (300 / distance) * (Math.random() - 0.5) * 15;

        initialData[base + 1] = Math.cos(angle) * distance;
        initialData[base + 2] = verticalSpread;
        initialData[base + 3] = Math.sin(angle) * distance;

        // MUCH faster initial tangential velocity so they establish an orbit
        const speed = 40 + (Math.random() * 30);
        initialData[base + 4] = -Math.sin(angle) * speed;
        initialData[base + 5] = (Math.random() - 0.5) * 10;
        initialData[base + 6] = Math.cos(angle) * speed;

        // Pre-seed some default color so it doesn't blink black on frame 1
        initialData[base + 11] = 0.2;
        initialData[base + 12] = 0.2;
        initialData[base + 13] = 0.5;
    }

    engine.updateBatchData(swarmBatch, initialData, MAX_INSTANCES);
    const timeData = new Float32Array([0]);

    return {
        update: (simTime: number) => {
            camera.bufferData[19] = simTime;
            timeData[0] = simTime;
            engine.updateBatchData(postBatch, timeData, 1);
        },
        cameraUpdate: (cam: Camera, time: number) => {
            const eye: [number, number, number] = [
                Math.sin(time * 0.15) * 180,
                60 + Math.sin(time * 0.08) * 40,
                Math.cos(time * 0.15) * 180
            ];
            cam.updateView(eye, [0, 0, 0]);
        },
        destroy: () => {
            camera.bufferData[19] = 0.0;
            offscreenTexture.destroy();
            offscreenDepth.destroy();
            vertexBuffer.destroy();
            indexBuffer.destroy();
            engine.clearPasses();
        }
    };
}