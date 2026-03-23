// demos/SceneGraphExample.ts
import { NullGraph, Camera } from 'null-graph';

class SceneNode {
    localPos: [number, number, number] = [0, 0, 0];
    localScale: [number, number, number] = [1, 1, 1];
    color: [number, number, number] = [1, 1, 1];
    children: SceneNode[] = [];

    // Animation properties
    initialAngle: number = Math.random() * Math.PI * 2;
    orbitRadius: number = 0;
    orbitSpeed: number = 0;

    // Cache world transforms
    worldPos: [number, number, number] = [0, 0, 0];
    worldScale: [number, number, number] = [1, 1, 1];

    // Recursive update
    updateTree(simTime: number, amplitude: number, parentPos: [number, number, number], parentScale: [number, number, number]) {
        // Calculate stateless orbit based on simTime
        if (this.orbitRadius > 0) {
            const currentAngle = this.initialAngle + (simTime * this.orbitSpeed);
            this.localPos[0] = Math.cos(currentAngle) * this.orbitRadius * amplitude *0.05;
            this.localPos[2] = Math.sin(currentAngle) * this.orbitRadius * amplitude * 0.05;
        }

        // Apply parent transforms
        this.worldPos[0] = parentPos[0] + (this.localPos[0] * parentScale[0]);
        this.worldPos[1] = parentPos[1] + (this.localPos[1] * parentScale[1]);
        this.worldPos[2] = parentPos[2] + (this.localPos[2] * parentScale[2]);

        this.worldScale[0] = parentScale[0] * this.localScale[0];
        this.worldScale[1] = parentScale[1] * this.localScale[1];
        this.worldScale[2] = parentScale[2] * this.localScale[2];

        // Update children (Pointer chasing!)
        for (const child of this.children) {
            child.updateTree(simTime, amplitude, this.worldPos, this.worldScale);
        }
    }

    // Recursive flatten for the GPU
    flattenInto(dataArray: Float32Array, context: { index: number }) {
        if (context.index >= 10000) return; // Cap at max instances

        const base = context.index * 14;

        dataArray[base + 1] = this.worldPos[0];
        dataArray[base + 2] = this.worldPos[1];
        dataArray[base + 3] = this.worldPos[2];

        dataArray[base + 8] = this.worldScale[0];
        dataArray[base + 9] = this.worldScale[1];
        dataArray[base + 10] = this.worldScale[2];

        dataArray[base + 11] = this.color[0];
        dataArray[base + 12] = this.color[1];
        dataArray[base + 13] = this.color[2];

        context.index++;

        for (const child of this.children) {
            child.flattenInto(dataArray, context);
        }
    }
}

export async function setupSceneGraph(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;

    // We reuse the AoS shader because we are ultimately flattening the tree
    // into the same buffer layout. The difference here is how the CPU calculates it!
    const shaderSource = `
        struct Camera { viewProj: mat4x4<f32> };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;

        struct VertexOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) color: vec3<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOut {
            let base = iIdx * 14u;
            let pos = vec3<f32>(ecs[base + 1u], ecs[base + 2u], ecs[base + 3u]);
            let scale = vec3<f32>(ecs[base + 8u], ecs[base + 9u], ecs[base + 10u]);
            let color = vec3<f32>(ecs[base + 11u], ecs[base + 12u], ecs[base + 13u]);

            var tri = array<vec2<f32>, 3>(vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
            let worldPos = (vec3<f32>(tri[vIdx], 0.0) * scale) + pos;

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(worldPos, 1.0);
            out.color = color;
            return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;

    engine.createPipeline({
        shaderCode: shaderSource,
        strideFloats: 14,
        maxInstances: MAX_INSTANCES
    });

    const root = new SceneNode();
    root.color = [1, 1, 0]; // Sun
    root.localScale = [5, 5, 5];

    let instanceCount = 1;
    const planetsToCreate = 100;

    for (let p = 0; p < planetsToCreate; p++) {
        if (instanceCount >= MAX_INSTANCES) break;

        const planet = new SceneNode();
        planet.orbitRadius = 10 + Math.random() * 80;
        planet.orbitSpeed = (Math.random() - 0.5) * 5;
        planet.color = [Math.random(), Math.random(), 1.0];
        planet.localScale = [0.5, 0.5, 0.5];
        root.children.push(planet);
        instanceCount++;

        const moonsToCreate = 99; // roughly 100 * 100 = 10,000 total
        for (let m = 0; m < moonsToCreate; m++) {
            if (instanceCount >= MAX_INSTANCES) break;

            const moon = new SceneNode();
            moon.orbitRadius = 2 + Math.random() * 5;
            moon.orbitSpeed = (Math.random() - 0.5) * 15;
            moon.color = [0.8, 0.8, 0.8];
            moon.localScale = [0.2, 0.2, 0.2];
            planet.children.push(moon);
            instanceCount++;
        }
    }

    const gpuBufferData = new Float32Array(MAX_INSTANCES * 14);

    return {
        update: (simTime: number) => {
            const uiState = getUiState();

            root.updateTree(simTime, uiState.amplitude, [0, 0, 0], [1, 1, 1]);

            const context = { index: 0 };
            root.flattenInto(gpuBufferData, context);

            engine.updateData(gpuBufferData, MAX_INSTANCES);
        },
        destroy: () => {
            console.log("Cleaning up OOP Scene Graph Demo");
        }
    };
}