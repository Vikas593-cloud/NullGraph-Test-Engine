// demos/SceneGraphExample.ts
import { NullGraph, Camera } from 'null-graph';
import {cubeIndices, cubeVertices, quadIndices, quadVertices} from "../data";

class SceneNode {
    // NEW: We tag the node so we know which batch it belongs to!
    type: 'planet' | 'moon' = 'planet';

    localPos: [number, number, number] = [0, 0, 0];
    localScale: [number, number, number] = [1, 1, 1];
    color: [number, number, number] = [1, 1, 1];
    children: SceneNode[] = [];

    initialAngle: number = Math.random() * Math.PI * 2;
    orbitRadius: number = 0;
    orbitSpeed: number = 0;

    worldPos: [number, number, number] = [0, 0, 0];
    worldScale: [number, number, number] = [1, 1, 1];

    updateTree(simTime: number, amplitude: number, parentPos: [number, number, number], parentScale: [number, number, number]) {
        if (this.orbitRadius > 0) {
            const currentAngle = this.initialAngle + (simTime * this.orbitSpeed);
            this.localPos[0] = Math.cos(currentAngle) * this.orbitRadius * amplitude * 0.05;
            this.localPos[2] = Math.sin(currentAngle) * this.orbitRadius * amplitude * 0.05;
        }

        this.worldPos[0] = parentPos[0] + (this.localPos[0] * parentScale[0]);
        this.worldPos[1] = parentPos[1] + (this.localPos[1] * parentScale[1]);
        this.worldPos[2] = parentPos[2] + (this.localPos[2] * parentScale[2]);

        this.worldScale[0] = parentScale[0] * this.localScale[0];
        this.worldScale[1] = parentScale[1] * this.localScale[1];
        this.worldScale[2] = parentScale[2] * this.localScale[2];

        for (const child of this.children) {
            child.updateTree(simTime, amplitude, this.worldPos, this.worldScale);
        }
    }

    // UPGRADED: It now takes TWO arrays and routes data based on its type
    flattenInto(
        planetData: Float32Array, planetCtx: { index: number },
        moonData: Float32Array, moonCtx: { index: number }
    ) {
        // Decide which array and counter to use
        const targetData = this.type === 'planet' ? planetData : moonData;
        const targetCtx = this.type === 'planet' ? planetCtx : moonCtx;

        if (targetCtx.index < 10000) {
            const base = targetCtx.index * 14;

            targetData[base + 1] = this.worldPos[0];
            targetData[base + 2] = this.worldPos[1];
            targetData[base + 3] = this.worldPos[2];

            targetData[base + 8] = this.worldScale[0];
            targetData[base + 9] = this.worldScale[1];
            targetData[base + 10] = this.worldScale[2];

            targetData[base + 11] = this.color[0];
            targetData[base + 12] = this.color[1];
            targetData[base + 13] = this.color[2];

            targetCtx.index++;
        }

        for (const child of this.children) {
            child.flattenInto(planetData, planetCtx, moonData, moonCtx);
        }
    }
}

export async function setupSceneGraph(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {


    const cubeVBO = engine.bufferManager.createVertexBuffer(cubeVertices);
    const cubeIBO = engine.bufferManager.createIndexBuffer(cubeIndices);
    const quadVBO = engine.bufferManager.createVertexBuffer(quadVertices);
    const quadIBO = engine.bufferManager.createIndexBuffer(quadIndices);
    const mainPass = engine.createPass({
        name: 'Scene Graph Main Pass',
        isMainScreenPass: true
    });

    // 2. THE SHADER
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@location(0) localPos: vec3<f32>, @location(1) localNorm: vec3<f32>, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            let worldPos = (localPos * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            
            // Simple lighting based on normal
            let light = max(dot(localNorm, normalize(vec3<f32>(1.0, 1.0, 0.5))), 0.2);
            out.color = color * light;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    // 3. CREATE TWO BATCHES!
    const pipelineConfig = {
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: 10000,
        vertexLayouts: [{
            arrayStride: 6 * 4,
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
                { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat }
            ]
        }]
    };

    const planetBatch = engine.createBatch(mainPass,pipelineConfig);
    engine.setBatchGeometry(planetBatch, cubeVBO, cubeIBO, cubeIndices.length);

    const moonBatch = engine.createBatch(mainPass,pipelineConfig);
    engine.setBatchGeometry(moonBatch, quadVBO, quadIBO, quadIndices.length);

    // 4. BUILD THE TREE
    const root = new SceneNode();
    root.type = 'planet';
    root.color = [1, 1, 0];
    root.localScale = [5, 5, 5];

    for (let p = 0; p < 100; p++) {
        const planet = new SceneNode();
        planet.type = 'planet';
        planet.orbitRadius = 10 + Math.random() * 80;
        planet.orbitSpeed = (Math.random() - 0.5) * 5;
        planet.color = [Math.random(), Math.random(), 1.0];
        planet.localScale = [0.5, 0.5, 0.5];
        root.children.push(planet);

        for (let m = 0; m < 99; m++) {
            const moon = new SceneNode();
            moon.type = 'moon'; // Tagged as a moon!
            moon.orbitRadius = 2 + Math.random() * 5;
            moon.orbitSpeed = (Math.random() - 0.5) * 15;
            moon.color = [0.8, 0.8, 0.8];
            moon.localScale = [0.2, 0.2, 0.2];
            planet.children.push(moon);
        }
    }

    // 5. SEPARATE GPU BUFFERS
    const planetData = new Float32Array(10000 * 14);
    const moonData = new Float32Array(10000 * 14);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            // 1. Calculate CPU Math
            root.updateTree(simTime, uiState.amplitude, [0, 0, 0], [1, 1, 1]);

            // 2. Flatten and Route into separate arrays
            const planetCtx = { index: 0 };
            const moonCtx = { index: 0 };
            root.flattenInto(planetData, planetCtx, moonData, moonCtx);

            // 3. Upload to their respective GPU batches
            engine.updateBatchData(planetBatch, planetData, planetCtx.index);
            engine.updateBatchData(moonBatch, moonData, moonCtx.index);
        },
        destroy: () => {
            engine.clearPasses();
            console.log("Cleaning up OOP Scene Graph Demo");
        }
    };
}