import { NullGraph } from 'null-graph';
import {halationScatteringPostProcess} from "./postProcessShaders";

export function setupPostProcessPipeline(engine: NullGraph, resolution: [number, number] = [2048, 2048]) {
    // 1. Create Offscreen Textures
    const offscreenTexture = engine.device.createTexture({
        size: resolution, format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });

    const offscreenDepth = engine.device.createTexture({
        size: resolution, format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const sampler = engine.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // 2. Create the Offscreen Pass (Characters render here)
    const offscreenPass = engine.createPass({
        name: 'Animated PBR Offscreen',
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

    // 3. Create the Post-Process Pass (Renders to screen)
    const postPass = engine.createPass({ name: 'Epic Post Process', isMainScreenPass: true });
    const postBatch = engine.createBatch(postPass, {
        shaderCode: halationScatteringPostProcess,
        strideFloats: 1,
        maxInstances: 1
    });

    engine.attachTextureMaterial(postBatch, offscreenTexture.createView(), sampler);

    return {
        offscreenPass,
        postBatch,
        destroy: () => {
            offscreenTexture.destroy();
            offscreenDepth.destroy();
        }
    };
}