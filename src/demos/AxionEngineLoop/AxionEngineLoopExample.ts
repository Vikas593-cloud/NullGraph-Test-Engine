// demos/MegabufferExample.ts
import {NullGraph, Camera, RenderBatch} from 'null-graph';
import {assetList, generateProceduralAsteroid} from "../../data/geometryData";
import {DynamicGeometryManager} from "null-graph/geometry";
import {GLBParser} from "null-graph/loaders";

export async function setupAxionEngineLoop(engine: NullGraph, camera: Camera, getUiState: () => { amplitude: number }) {
    const MAX_INSTANCES = 10000;
    const MAX_VERTICES = 500_000;
    const MAX_INDICES = 1_500_000;
    const MAX_BLOCKS = 200;
    const INSTANCES_PER_MESH = Math.floor(MAX_INSTANCES / MAX_BLOCKS);

    // 1. Initialize our Dynamic Geometry Tracker
    const geomManager = new DynamicGeometryManager(engine.device, MAX_VERTICES, MAX_INDICES, 8);

    const mainPass = engine.createPass({
        name: 'Mega Buffer Main Pass',
        isMainScreenPass: true
    });
    const colorMapTex = await engine.textureManager.load('./textures/colormap.png', { sRGB: true });
    const defaultSampler = engine.textureManager.defaultSampler;

    const freeInstanceBlocks: number[] = [];
    for(let i = 0; i < MAX_BLOCKS; i++) {
        // Push the starting offsets: 0, 200, 400, 600...
        freeInstanceBlocks.push(i * INSTANCES_PER_MESH);
    }
    // Reverse it so we pop from the front of the array easily
    freeInstanceBlocks.reverse();

    // --- FIX 2: TRACK THE BATCH AND ITS START INDEX ---
    // We need to remember the startIndex so we can give it back when we delete the mesh!
    // Look for this line in setupAxionEngineLoop:
    const activeBatches = new Map<string, { batch: RenderBatch, startIndex: number, instanceCount: number }>();

    // --- COMPUTE & RENDER SHADERS ---
    // Stride is 16.
    // [1,2,3] = Pos, [4,5,6] = RotAxis, [7] = RotSpeed, [8,9,10] = Scale, [11,12,13] = Color, [14] = MeshID
    const generateComputeShader = (startIndex: number, count: number) => `
        struct IndirectDrawArgs { indexCount: u32, instanceCount: atomic<u32>, firstIndex: u32, baseVertex: u32, firstInstance: u32 };
        struct Camera { viewProj: mat4x4<f32>, position: vec3<f32>, time: f32 };

        @group(0) @binding(0) var<uniform> camera: Camera; 
        @group(0) @binding(1) var<storage, read> sourceData: array<f32>;
        @group(0) @binding(2) var<storage, read_write> culledData: array<f32>;
        @group(0) @binding(3) var<storage, read_write> drawArgs: IndirectDrawArgs;

        @compute @workgroup_size(64)
        fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let local_idx = global_id.x;
            if (local_idx >= ${count}u) { return; } 

            let actual_idx = local_idx + ${startIndex}u;
            let base = actual_idx * 16u; 
            
            // 1. Read the anchor position
            var pos = vec3<f32>(sourceData[base+1u], sourceData[base+2u], sourceData[base+3u]);
            
            // --- NEW: THE JIGGLE MATH ---
            // Use the object's unique ID so they don't all bob up and down at the exact same time
            let float_idx = f32(actual_idx);
            let time = camera.time;
            
            // Speed = 2.0, Height = 5.0 units, Offset = float_idx
            let hoverOffset = sin(time * 2.0 + float_idx * 0.5) * 5.0; 
            
            // Apply it to the Y axis!
            pos.y += hoverOffset;
            
            // 2. Cull against the camera using the NEW position
            let dist = distance(pos, camera.position);
            
            if (dist < 600.0) {
                let writeIdx = atomicAdd(&drawArgs.instanceCount, 1u);
                let writeBase = writeIdx * 16u;
                
                // Copy everything from the anchor data...
                for(var i = 0u; i < 16u; i = i + 1u) { 
                    culledData[writeBase + i] = sourceData[base + i]; 
                }
                
                // ...but overwrite the Y position with our animated hover!
                culledData[writeBase + 2u] = pos.y;
            }
        }
    `;

    const renderShaderCode = `
        struct Camera { viewProj: mat4x4<f32>, position: vec3<f32>, time: f32 };
        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(0) @binding(1) var<storage, read> ecs: array<f32>;
        @group(1) @binding(1) var colorMap: texture_2d<f32>;
        @group(1) @binding(0) var samp: sampler;
        
        struct VertexOut { @builtin(position) pos: vec4<f32>, 
            @location(0) color: vec3<f32>, 
            @location(1) normal: vec3<f32>,
            @location(2) uv: vec2<f32>};

        // Helper to rotate vertices on the GPU
        fn rotate(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
            let s = sin(angle); let c = cos(angle); let ic = 1.0 - c;
            return v * c + cross(axis, v) * s + axis * dot(axis, v) * ic;
        }

       @vertex
        fn vs_main(
            @location(0) localPos: vec3<f32>, 
            @location(1) localNormal: vec3<f32>, 
            @location(2) uv: vec2<f32>, 
            @builtin(instance_index) iIdx: u32
        ) -> VertexOut { 
            let base = iIdx * 16u;
            let pos = vec3<f32>(ecs[base+1u], ecs[base+2u], ecs[base+3u]);
            let axis = vec3<f32>(ecs[base+4u], ecs[base+5u], ecs[base+6u]);
            let speed = ecs[base+7u];
            let scale = vec3<f32>(ecs[base+8u], ecs[base+9u], ecs[base+10u]);
            let color = vec3<f32>(ecs[base+11u], ecs[base+12u], ecs[base+13u]);
            
            // GPU-Driven animation!
            let animatedPos = rotate(localPos * scale, normalize(axis), camera.time * speed);
            let animatedNorm = rotate(localNormal, normalize(axis), camera.time * speed);

            var out: VertexOut;
            out.pos = camera.viewProj * vec4<f32>(animatedPos + pos, 1.0);
            out.color = color; 
            out.normal = animatedNorm;
            out.uv = uv; 
            return out;
        }

        @fragment
        fn fs_main(
            @location(0) color: vec3<f32>, 
            @location(1) normal: vec3<f32>, 
            @location(2) uv: vec2<f32> 
        ) -> @location(0) vec4<f32> {
            let lightDir = normalize(vec3<f32>(1.0, 2.0, 0.5));
            let diffuse = max(dot(normal, lightDir), 0.0); 
            let ambient = 2.0;
            
            let texColor = textureSample(colorMap, samp, uv).rgb;
            let finalColor = texColor * color;
            
            return vec4<f32>(finalColor * (ambient + diffuse), 1.0);
        }
    `;

    const vertexLayout = {
        arrayStride: 32,
        attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat},  // Pos
            {shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat}, // Normal
            {shaderLocation: 2, offset: 24, format: 'float32x2' as GPUVertexFormat}  // NEW: UV
        ]
    };
    const sharedSourceBuffer = engine.device.createBuffer({
        size: MAX_INSTANCES * 16 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 2. Seed the initial geometry directly into the manager
    const allBatches: RenderBatch[] = [];


    const INITIAL_MESHES = 48;
    for (let i = 0; i < assetList.length; i++) {
        const meshName = assetList[i];

        // Load the GLB!
        const glbData = await GLBParser.loadMerged(`./3dAssetsNotIncluded/${meshName}`);

        if(!glbData.meshes){
            console.log("Missing mesh data")
            return ;
        }
        const mesh = glbData.meshes[0]; // Assuming one mesh per file

        const startIndex = freeInstanceBlocks.pop()!;

        // The parser returns a typed array for indices, but DynamicGeometryManager needs Uint32
       // const indices32 = mesh.indices instanceof Uint32Array ? mesh.indices : new Uint32Array(mesh.indices);

        // ADD TO MEGA BUFFER
        const offset = geomManager.addMesh(meshName,mesh.vertices, mesh.indices);

        const batch = engine.createBatch(mainPass, {
            isIndirect: true,
            computeShaderCode: generateComputeShader(startIndex, INSTANCES_PER_MESH),
            shaderCode: renderShaderCode,
            strideFloats: 16,
            maxInstances: MAX_INSTANCES,
            vertexLayouts: mesh.getWebGPULayout(),
            sharedSourceBuffer: sharedSourceBuffer,
            depthWriteEnabled:true
        });

        // Attach the universal Texture Atlas to this batch's Group 1
        engine.attachTextureMaterial(batch, colorMapTex, defaultSampler);

        engine.device.queue.writeBuffer(batch.indirectBuffer!, 0, new Uint32Array([
            offset.indexCount, 0, offset.firstIndex, offset.baseVertex, 0
        ]));

        engine.setBatchGeometry(batch, geomManager.vbo, geomManager.ibo, MAX_INDICES, 'uint32');

        activeBatches.set(meshName, { batch, startIndex, instanceCount: INSTANCES_PER_MESH });
    }



    // 4. POPULATE ECS DATA (Upload Once!)
    const data = new Float32Array(MAX_INSTANCES * 16);
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * 16;
        data[base + 1] = (Math.random() - 0.5) * 1200;
        data[base + 2] = (Math.random() - 0.5) * 400;
        data[base + 3] = (Math.random() - 0.5) * 1200;

        data[base + 4] = Math.random() - 0.5;
        data[base + 5] = Math.random() - 0.5;
        data[base + 6] = Math.random() - 0.5;
        data[base + 7] = (Math.random() * 2.0) - 1.0;

        const s = 4 + Math.random() * 2.0;
        data[base + 8] = s; data[base + 9] = s; data[base + 10] = s;

        data[base + 11] = Math.random() * 0.5;
        data[base + 12] = 0.5 + Math.random() * 0.5;
        data[base + 13] = 0.8 + Math.random() * 0.2;

        // Group them logically instead of randomly!
        data[base + 14] = Math.floor(i / INSTANCES_PER_MESH);
    }

    // ONE-TIME UPLOAD
    engine.device.queue.writeBuffer(sharedSourceBuffer, 0, data.buffer, data.byteOffset, MAX_INSTANCES * 16 * 4);

    return {
        update: (simTime: number) => {
            // Hijack the camera's padding float to pass "time" to the shaders
            // Since camera.bufferData is a Float32Array, index 19 is the 20th float (the padding).
            camera.bufferData[19] = simTime * 1;
            for(const [name, record] of activeBatches) {
                record.batch.currentInstanceCount = record.instanceCount;
            }
        },
        destroy: () => {
            engine.clearPasses();
            sharedSourceBuffer.destroy();
        },
        // Add customCount as an optional parameter (defaults to undefined)
        addNewGeometryMidFlight: (meshName: string, mesh: {v: Float32Array, i: Uint16Array}, rgb: [number, number, number], customCount?: number) => {
            if (activeBatches.has(meshName)) return;

            if (freeInstanceBlocks.length === 0) {
                console.warn("Max instances reached!");
                return;
            }

            // Determine how many we actually want to draw.
            // If the user didn't specify a count, default to the max block size (200).
            const actualCount = customCount || INSTANCES_PER_MESH;

            // Safety check: You cannot ask for more than the block can hold!
            if (actualCount > INSTANCES_PER_MESH) {
                console.warn(`Cannot spawn ${actualCount}. Max per block is ${INSTANCES_PER_MESH}`);
                return;
            }

            const startIndex = freeInstanceBlocks.pop()!;

            const indices32 = new Uint32Array(mesh.i);
            const offset = geomManager.addMesh(meshName, mesh.v, indices32);

            const batch = engine.createBatch(mainPass, {
                isIndirect: true,
                // Tell the Compute Shader to only evaluate 'actualCount', leaving the rest of the block ignored!
                computeShaderCode: generateComputeShader(startIndex, actualCount),
                shaderCode: renderShaderCode,
                strideFloats: 16,
                maxInstances: MAX_INSTANCES,
                vertexLayouts: [vertexLayout],
                sharedSourceBuffer: sharedSourceBuffer,
                depthWriteEnabled:true
            });
            engine.attachTextureMaterial(batch, colorMapTex, defaultSampler);

            engine.device.queue.writeBuffer(batch.indirectBuffer!, 0, new Uint32Array([
                offset.indexCount, 0, offset.firstIndex, offset.baseVertex, 0
            ]));
            engine.setBatchGeometry(batch, geomManager.vbo, geomManager.ibo, MAX_INDICES, 'uint32');

            // --- ONLY GENERATE POSITIONS FOR THE REQUESTED COUNT ---
            const newData = new Float32Array(actualCount * 16);
            for (let i = 0; i < actualCount; i++) {
                const base = i * 16;
                const angle = (i / actualCount) * Math.PI * 2; // Spread them out perfectly!

                newData[base + 1] = Math.cos(angle) * 150;
                newData[base + 2] = 0;
                newData[base + 3] = Math.sin(angle) * 150;
                newData[base + 4] = 0; newData[base + 5] = 1; newData[base + 6] = 0;
                newData[base + 7] = 3.0;
                newData[base + 8] = 5.0; newData[base + 9] = 5.0; newData[base + 10] = 5.0;
                newData[base + 11] = rgb[0]; newData[base + 12] = rgb[1]; newData[base + 13] = rgb[2];
            }

            const byteOffset = startIndex * 16 * 4;
            engine.device.queue.writeBuffer(sharedSourceBuffer, byteOffset, newData.buffer);

            // Save everything in our tracker map, including the custom count!
            activeBatches.set(meshName, { batch, startIndex, instanceCount: actualCount });
        },
        removeGeometryMidFlight: (meshName: string) => {
            const record = activeBatches.get(meshName);
            if (!record) return;
            const batch = activeBatches.get(meshName);
            if (!batch) return;

            // 1. Free VBO/IBO Memory
            geomManager.removeMesh(meshName);
            freeInstanceBlocks.push(record.startIndex);

            engine.clearBatch(mainPass, record.batch); // Assuming your engine has this method
            activeBatches.delete(meshName);
        }
    };
}
//
//'ambulance.glb', 'animal-beaver.glb', 'animal-bee.glb', 'animal-bunny.glb', 'animal-cat.glb', 'animal-caterpillar.glb', 'animal-chick.glb', 'animal-cow.glb', 'animal-crab.glb', 'animal-deer.glb', 'animal-dog.glb', 'animal-elephant.glb', 'animal-fish.glb', 'animal-fox.glb', 'animal-giraffe.glb', 'animal-hog.glb', 'animal-koala.glb', 'animal-lion.glb', 'animal-monkey.glb', 'animal-panda.glb', 'animal-parrot.glb', 'animal-penguin.glb', 'animal-pig.glb', 'animal-polar.glb', 'animal-tiger.glb', 'barrel.glb', 'blaster-a.glb', 'blaster-b.glb', 'blaster-c.glb', 'blaster-d.glb', 'blaster-e.glb', 'blaster-f.glb', 'blaster-g.glb', 'blaster-h.glb', 'blaster-i.glb', 'blaster-j.glb', 'blaster-k.glb', 'blaster-l.glb', 'blaster-m.glb', 'blaster-n.glb', 'blaster-o.glb', 'blaster-p.glb', 'blaster-q.glb', 'blaster-r.glb', 'boat-row-large.glb', 'boat-row-small.glb', 'bottle-large.glb', 'bottle.glb', 'box.glb', 'bullet-foam-thick.glb', 'bullet-foam-tip-thick.glb', 'bullet-foam-tip.glb', 'bullet-foam.glb', 'cannon-ball.glb', 'cannon-mobile.glb', 'cannon.glb', 'castle-door.glb', 'castle-gate.glb', 'castle-wall.glb', 'castle-window.glb', 'chest.glb', 'clip-large.glb', 'clip-small.glb', 'cone-flat.glb', 'cone.glb', 'crate-bottles.glb', 'crate-medium.glb', 'crate-small.glb', 'crate-wide.glb', 'crate.glb', 'debris-bolt.glb', 'debris-bumper.glb', 'debris-door-window.glb', 'debris-door.glb', 'debris-drivetrain-axle.glb', 'debris-drivetrain.glb', 'debris-nut.glb', 'debris-plate-a.glb', 'debris-plate-b.glb', 'debris-plate-small-a.glb', 'debris-plate-small-b.glb', 'debris-spoiler-a.glb', 'debris-spoiler-b.glb', 'debris-tire.glb', 'delivery-flat.glb', 'delivery.glb', 'firetruck.glb', 'flag-high-pennant.glb', 'flag-high.glb', 'flag-pennant.glb', 'flag-pirate-high-pennant.glb', 'flag-pirate-high.glb', 'flag-pirate-pennant.glb', 'flag-pirate.glb', 'flag.glb', 'garbage-truck.glb', 'grass-patch.glb', 'grass-plant.glb', 'grass.glb', 'grenade-a.glb', 'grenade-b.glb', 'hatchback-sports.glb', 'hole.glb', 'kart-oobi.glb', 'kart-oodi.glb', 'kart-ooli.glb', 'kart-oopi.glb', 'kart-oozi.glb', 'mast-ropes.glb', 'mast.glb', 'monkey.glb', 'palm-bend.glb', 'palm-detailed-bend.glb', 'palm-detailed-straight.glb', 'palm-straight.glb', 'patch-grass-foliage.glb', 'patch-grass.glb', 'patch-sand-foliage.glb', 'patch-sand.glb', 'platform-planks.glb', 'platform.glb', 'police.glb', 'race-future.glb', 'race.glb', 'rocks-a.glb', 'rocks-b.glb', 'rocks-c.glb', 'rocks-sand-a.glb', 'rocks-sand-b.glb', 'rocks-sand-c.glb', 'scope-large-a.glb', 'scope-large-b.glb', 'scope-small.glb', 'sedan-sports.glb', 'sedan.glb', 'ship-ghost.glb', 'ship-large.glb', 'ship-medium.glb', 'ship-pirate-large.glb', 'ship-pirate-medium.glb', 'ship-pirate-small.glb', 'ship-small.glb', 'ship-wreck.glb', 'silencer-larger.glb', 'silencer-small.glb', 'smoke.glb', 'structure-fence-sides.glb', 'structure-fence.glb', 'structure-platform-dock-small.glb', 'structure-platform-dock.glb', 'structure-platform-small.glb', 'structure-platform.glb', 'structure-roof.glb', 'structure.glb', 'suv-luxury.glb', 'suv.glb', 'target-detail.glb', 'target-fragment-large.glb', 'target-fragment-small.glb', 'target-large.glb', 'target-small.glb', 'taxi.glb', 'tool-paddle.glb', 'tool-shovel.glb', 'tower-base-door.glb', 'tower-base.glb', 'tower-complete-large.glb', 'tower-complete-small.glb', 'tower-middle-windows.glb', 'tower-middle.glb', 'tower-roof.glb', 'tower-top.glb', 'tower-watch.glb', 'tractor-police.glb', 'tractor-shovel.glb', 'tractor.glb', 'truck-flat.glb', 'truck.glb', 'van.glb', 'wheel-dark.glb', 'wheel-default.glb', 'wheel-racing.glb', 'wheel-tractor-back.glb', 'wheel-tractor-dark-back.glb', 'wheel-tractor-dark-front.glb', 'wheel-tractor-front.glb', 'wheel-truck.glb'