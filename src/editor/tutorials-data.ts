
export const TUTORIAL_CODES: Record<string, { ts: string, js: string }> = {
'tutorial-hello-world': {
ts: `
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";
import { buildPBRShader, StandardPBRMaterial } from "null-graph/materials";

async function main() {
const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
canvas.width = canvas.clientWidth || 800;
canvas.height = Math.max(1, canvas.clientHeight || 600);

const engine = new NullGraph();
await engine.init(canvas);

const mainPass = engine.createPass({ name: 'Main', isMainScreenPass: true });

const cubeGeom = Primitives.createCube(StandardLayout, 2, 2, 2);
cubeGeom.upload(engine);

const material = new StandardPBRMaterial(engine, {
albedoMap: engine.textureManager.fallbackWhite,
normalMap: engine.textureManager.fallbackNormal,
packedMap: engine.textureManager.fallbackWhite,
packedMapFormat: "ARM",
baseColor: [0.1, 0.5, 0.9, 1.0],
metallicMultiplier: 0.2,
roughnessMultiplier: 0.5
});

const cubeBatch = engine.createBatch(mainPass, {
shaderCode: buildPBRShader({ useSkinning: false }),
strideFloats: 14,
maxInstances: 1,
vertexLayouts: cubeGeom.layout.getWebGPUDescriptor(),
depthWriteEnabled: true
});

material.applyToBatch(cubeBatch);
engine.setBatchGeometry(cubeBatch, cubeGeom.vertexBuffer, cubeGeom.indexBuffer, cubeGeom.indices.length);

const initialData = new Float32Array(14);
initialData[7] = 1.0; initialData[8] = 1.0; initialData[9] = 1.0; initialData[10] = 1.0;
initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0;
engine.updateBatchData(cubeBatch, initialData, 1);

const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);

function frame() {
if (!engine.isDestroyed) {
const simTime = performance.now() * 0.001;
camera.updateView([Math.sin(simTime) * 6, 3, Math.cos(simTime) * 6], [0, 0, 0]);
engine.updateCamera(camera);
engine.render();
requestAnimationFrame(frame);
}
}

frame();
}

main().catch(err => console.error("Engine Crash:", err));
`.trim(),

js: `
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";
import { buildPBRShader, StandardPBRMaterial } from "null-graph/materials";

// Notice: No TypeScript types here! Pure Vanilla JS.
async function main() {
const canvas = document.getElementById('gpuCanvas');
canvas.width = canvas.clientWidth || 800;
canvas.height = Math.max(1, canvas.clientHeight || 600);

const engine = new NullGraph();
await engine.init(canvas);

const mainPass = engine.createPass({ name: 'Main', isMainScreenPass: true });

const cubeGeom = Primitives.createCube(StandardLayout, 2, 2, 2);
cubeGeom.upload(engine);

const material = new StandardPBRMaterial(engine, {
albedoMap: engine.textureManager.fallbackWhite,
normalMap: engine.textureManager.fallbackNormal,
packedMap: engine.textureManager.fallbackWhite,
packedMapFormat: "ARM",
baseColor: [0.9, 0.2, 0.2, 1.0], // Made it red to prove we are in JS mode!
metallicMultiplier: 0.2,
roughnessMultiplier: 0.5
});

const cubeBatch = engine.createBatch(mainPass, {
shaderCode: buildPBRShader({ useSkinning: false }),
strideFloats: 14,
maxInstances: 1,
vertexLayouts: cubeGeom.layout.getWebGPUDescriptor(),
depthWriteEnabled: true
});

material.applyToBatch(cubeBatch);
engine.setBatchGeometry(cubeBatch, cubeGeom.vertexBuffer, cubeGeom.indexBuffer, cubeGeom.indices.length);

const initialData = new Float32Array(14);
initialData[7] = 1.0; initialData[8] = 1.0; initialData[9] = 1.0; initialData[10] = 1.0;
initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0;
engine.updateBatchData(cubeBatch, initialData, 1);

const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);

function frame() {
if (!engine.isDestroyed) {
const simTime = performance.now() * 0.001;
camera.updateView([Math.sin(simTime) * 6, 3, Math.cos(simTime) * 6], [0, 0, 0]);
engine.updateCamera(camera);
engine.render();
requestAnimationFrame(frame);
}
}

frame();
}

main().catch(err => console.error("Engine Crash:", err));
`.trim()
}
};
