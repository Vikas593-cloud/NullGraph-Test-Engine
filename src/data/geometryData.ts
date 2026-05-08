import {GeometryBuilder, StandardLayout} from "null-graph/geometry";

export function generateDummyData(count: number, stride: number) {
    const data = new Float32Array(count * stride);
    for (let i = 0; i < count; i++) {
        const base = i * stride;
        // Position
        data[base + 1] = (Math.random() - 0.5) * 150;
        data[base + 2] = (Math.random() - 0.5) * 150;
        data[base + 3] = (Math.random() - 0.5) * 150;
        // Scale
        data[base + 8] = data[base + 9] = data[base + 10] = Math.random() * 2 + 0.5;
        // Color
        data[base + 11] = Math.random();
        data[base + 12] = Math.random();
        data[base + 13] = Math.random();
    }
    return data;
}

export const cubeVertices = new Float32Array([
    -0.5, -0.5,  0.5,   0, 0, 1,    0.5, -0.5,  0.5,   0, 0, 1,
    0.5,  0.5,  0.5,   0, 0, 1,   -0.5,  0.5,  0.5,   0, 0, 1,
    0.5, -0.5, -0.5,   0, 0, -1,  -0.5, -0.5, -0.5,   0, 0, -1,
    -0.5,  0.5, -0.5,   0, 0, -1,   0.5,  0.5, -0.5,   0, 0, -1,
    0.5, -0.5,  0.5,   1, 0, 0,    0.5, -0.5, -0.5,   1, 0, 0,
    0.5,  0.5, -0.5,   1, 0, 0,    0.5,  0.5,  0.5,   1, 0, 0,
    -0.5, -0.5, -0.5,  -1, 0, 0,   -0.5, -0.5,  0.5,  -1, 0, 0,
    -0.5,  0.5,  0.5,  -1, 0, 0,   -0.5,  0.5, -0.5,  -1, 0, 0,
    -0.5,  0.5,  0.5,   0, 1, 0,    0.5,  0.5,  0.5,   0, 1, 0,
    0.5,  0.5, -0.5,   0, 1, 0,   -0.5,  0.5, -0.5,   0, 1, 0,
    -0.5, -0.5, -0.5,   0, -1, 0,   0.5, -0.5, -0.5,   0, -1, 0,
    0.5, -0.5,  0.5,   0, -1, 0,   -0.5, -0.5,  0.5,   0, -1, 0,
]);

export const cubeIndices = new Uint16Array([
    0, 1, 2, 2, 3, 0,       4, 5, 6, 6, 7, 4,
    8, 9, 10, 10, 11, 8,    12, 13, 14, 14, 15, 12,
    16, 17, 18, 18, 19, 16, 20, 21, 22, 22, 23, 20
]);


// Low Poly Triangle
export const triVertices = new Float32Array([
    0.0,  0.5, 0.0,   0, 0, 1,   -0.5, -0.5, 0.0,   0, 0, 1,    0.5, -0.5, 0.0,   0, 0, 1
]);
export const triIndices = new Uint16Array([0, 1, 2]);

// Pyramid (square base)
export const pyramidVertices = new Float32Array([
    // Base (y = -0.5)
    -0.5, -0.5,  0.5,   0, -1, 0,
    0.5, -0.5,  0.5,   0, -1, 0,
    0.5, -0.5, -0.5,   0, -1, 0,
    -0.5, -0.5, -0.5,   0, -1, 0,

    // Front face
    -0.5, -0.5,  0.5,   0, 0.5, 1,
    0.5, -0.5,  0.5,   0, 0.5, 1,
    0.0,  0.5,  0.0,   0, 0.5, 1,

    // Right face
    0.5, -0.5,  0.5,   1, 0.5, 0,
    0.5, -0.5, -0.5,   1, 0.5, 0,
    0.0,  0.5,  0.0,   1, 0.5, 0,

    // Back face
    0.5, -0.5, -0.5,   0, 0.5, -1,
    -0.5, -0.5, -0.5,   0, 0.5, -1,
    0.0,  0.5,  0.0,   0, 0.5, -1,

    // Left face
    -0.5, -0.5, -0.5,  -1, 0.5, 0,
    -0.5, -0.5,  0.5,  -1, 0.5, 0,
    0.0,  0.5,  0.0,  -1, 0.5, 0,
]);

export const pyramidIndices = new Uint16Array([
    // Base (2 triangles)
    0, 1, 2,
    2, 3, 0,

    // Front
    4, 5, 6,

    // Right
    7, 8, 9,

    // Back
    10, 11, 12,

    // Left
    13, 14, 15,
]);


export const quadVertices = new Float32Array([
    // Flat diamond shape for moons
    -0.5, 0.0,  0.0,   0, 1, 0,    0.0, 0.0,  0.5,   0, 1, 0,
    0.5, 0.0,  0.0,   0, 1, 0,    0.0, 0.0, -0.5,   0, 1, 0,
]);
export const quadIndices = new Uint16Array([0, 1, 2, 2, 3, 0]);

// --- Octahedron (Floating Crystal / Diamond) ---
// 8 faces * 3 vertices = 24 vertices.
// The normals are calculated as 1/sqrt(3) = 0.577 to give perfect 45-degree angled lighting.

export const octahedronVertices = new Float32Array([
    // Top-Front-Right Face
    0.5,  0.0,  0.0,    0.577,  0.577,  0.577,
    0.0,  0.0,  0.5,    0.577,  0.577,  0.577,
    0.0,  0.5,  0.0,    0.577,  0.577,  0.577,

    // Top-Front-Left Face
    0.0,  0.0,  0.5,   -0.577,  0.577,  0.577,
    -0.5,  0.0,  0.0,   -0.577,  0.577,  0.577,
    0.0,  0.5,  0.0,   -0.577,  0.577,  0.577,

    // Top-Back-Left Face
    -0.5,  0.0,  0.0,   -0.577,  0.577, -0.577,
    0.0,  0.0, -0.5,   -0.577,  0.577, -0.577,
    0.0,  0.5,  0.0,   -0.577,  0.577, -0.577,

    // Top-Back-Right Face
    0.0,  0.0, -0.5,    0.577,  0.577, -0.577,
    0.5,  0.0,  0.0,    0.577,  0.577, -0.577,
    0.0,  0.5,  0.0,    0.577,  0.577, -0.577,

    // Bottom-Front-Right Face
    0.0,  0.0,  0.5,    0.577, -0.577,  0.577,
    0.5,  0.0,  0.0,    0.577, -0.577,  0.577,
    0.0, -0.5,  0.0,    0.577, -0.577,  0.577,

    // Bottom-Front-Left Face
    -0.5,  0.0,  0.0,   -0.577, -0.577,  0.577,
    0.0,  0.0,  0.5,   -0.577, -0.577,  0.577,
    0.0, -0.5,  0.0,   -0.577, -0.577,  0.577,

    // Bottom-Back-Left Face
    0.0,  0.0, -0.5,   -0.577, -0.577, -0.577,
    -0.5,  0.0,  0.0,   -0.577, -0.577, -0.577,
    0.0, -0.5,  0.0,   -0.577, -0.577, -0.577,

    // Bottom-Back-Right Face
    0.5,  0.0,  0.0,    0.577, -0.577, -0.577,
    0.0,  0.0, -0.5,    0.577, -0.577, -0.577,
    0.0, -0.5,  0.0,    0.577, -0.577, -0.577,
]);

// Because we duplicated the vertices for flat shading, the index buffer is perfectly sequential!
export const octahedronIndices = new Uint16Array([
    0,  1,  2, // Top-Front-Right
    3,  4,  5, // Top-Front-Left
    6,  7,  8, // Top-Back-Left
    9, 10, 11, // Top-Back-Right
    12, 13, 14, // Bottom-Front-Right
    15, 16, 17, // Bottom-Front-Left
    18, 19, 20, // Bottom-Back-Left
    21, 22, 23  // Bottom-Back-Right
]);

// Updated Cube Vertices (Stride: 8 floats / 32 bytes)
// Layout: [ PosX, PosY, PosZ,  NormX, NormY, NormZ,  U, V ]
export const cubeVerticesWithUV = new Float32Array([
    // Front face (Z = 0.5)
    -0.5, -0.5,  0.5,    0,  0,  1,    0.0, 1.0,  // Bottom-Left
    0.5, -0.5,  0.5,    0,  0,  1,    1.0, 1.0,  // Bottom-Right
    0.5,  0.5,  0.5,    0,  0,  1,    1.0, 0.0,  // Top-Right
    -0.5,  0.5,  0.5,    0,  0,  1,    0.0, 0.0,  // Top-Left

    // Back face (Z = -0.5)
    0.5, -0.5, -0.5,    0,  0, -1,    0.0, 1.0,  // Bottom-Left (from back)
    -0.5, -0.5, -0.5,    0,  0, -1,    1.0, 1.0,  // Bottom-Right
    -0.5,  0.5, -0.5,    0,  0, -1,    1.0, 0.0,  // Top-Right
    0.5,  0.5, -0.5,    0,  0, -1,    0.0, 0.0,  // Top-Left

    // Right face (X = 0.5)
    0.5, -0.5,  0.5,    1,  0,  0,    0.0, 1.0,  // Bottom-Left
    0.5, -0.5, -0.5,    1,  0,  0,    1.0, 1.0,  // Bottom-Right
    0.5,  0.5, -0.5,    1,  0,  0,    1.0, 0.0,  // Top-Right
    0.5,  0.5,  0.5,    1,  0,  0,    0.0, 0.0,  // Top-Left

    // Left face (X = -0.5)
    -0.5, -0.5, -0.5,   -1,  0,  0,    0.0, 1.0,  // Bottom-Left
    -0.5, -0.5,  0.5,   -1,  0,  0,    1.0, 1.0,  // Bottom-Right
    -0.5,  0.5,  0.5,   -1,  0,  0,    1.0, 0.0,  // Top-Right
    -0.5,  0.5, -0.5,   -1,  0,  0,    0.0, 0.0,  // Top-Left

    // Top face (Y = 0.5)
    -0.5,  0.5,  0.5,    0,  1,  0,    0.0, 1.0,  // Bottom-Left
    0.5,  0.5,  0.5,    0,  1,  0,    1.0, 1.0,  // Bottom-Right
    0.5,  0.5, -0.5,    0,  1,  0,    1.0, 0.0,  // Top-Right
    -0.5,  0.5, -0.5,    0,  1,  0,    0.0, 0.0,  // Top-Left

    // Bottom face (Y = -0.5)
    -0.5, -0.5, -0.5,    0, -1,  0,    0.0, 1.0,  // Bottom-Left
    0.5, -0.5, -0.5,    0, -1,  0,    1.0, 1.0,  // Bottom-Right
    0.5, -0.5,  0.5,    0, -1,  0,    1.0, 0.0,  // Top-Right
    -0.5, -0.5,  0.5,    0, -1,  0,    0.0, 0.0,  // Top-Left
]);


export function generateProceduralAsteroid(numSides: number, radius: number, isCrystal: boolean) {
    const builder = new GeometryBuilder(StandardLayout);
    const heightMult = isCrystal ? 2.5 : 1.0;

    // 1. Add Top and Bottom points
    const topIdx = builder.addVertex({
        position: [0, radius * heightMult, 0],
        normal: [0, 1, 0],
        uv: [0.5, 1.0]
    });

    const btmIdx = builder.addVertex({
        position: [0, -radius * heightMult, 0],
        normal: [0, -1, 0],
        uv: [0.5, 0.0]
    });

    // 2. Add the middle ring
    const ringStartIdx = topIdx + 2; // The next vertex added will be index 2

    for (let i = 0; i < numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2;
        // Crystals are sharper, asteroids are rounder
        const r = radius * (isCrystal ? (0.3 + Math.random() * 0.7) : (0.7 + Math.random() * 0.3));
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        builder.addVertex({
            position: [x, (Math.random() - 0.5) * radius * 0.5, z],
            normal: [x, 0.5, z], // Keeping your original radial normal logic
            uv: [i / numSides, 0.5]
        });
    }

    // 3. Stitch the indices together
    for (let i = 0; i < numSides; i++) {
        const next = (i + 1) % numSides;

        // Top half triangle
        builder.addTriangle(topIdx, ringStartIdx + i, ringStartIdx + next);

        // Bottom half triangle
        builder.addTriangle(btmIdx, ringStartIdx + next, ringStartIdx + i);
    }

    // Returns { v: Float32Array, i: Uint16Array }
    return builder.build();
}

export const assetList=[
    'ambulance.glb', 'animal-beaver.glb', 'animal-bee.glb', 'animal-bunny.glb', 'animal-cat.glb', 'animal-caterpillar.glb', 'animal-chick.glb', 'animal-cow.glb', 'animal-crab.glb', 'animal-deer.glb', 'animal-dog.glb', 'animal-elephant.glb', 'animal-fish.glb', 'animal-fox.glb', 'animal-giraffe.glb', 'animal-hog.glb', 'animal-koala.glb', 'animal-lion.glb', 'animal-monkey.glb', 'animal-panda.glb', 'animal-parrot.glb', 'animal-penguin.glb', 'animal-pig.glb', 'animal-polar.glb', 'animal-tiger.glb', 'barrel.glb', 'blaster-a.glb', 'blaster-b.glb', 'blaster-c.glb', 'blaster-d.glb', 'blaster-e.glb', 'blaster-f.glb', 'blaster-g.glb', 'blaster-h.glb', 'blaster-i.glb', 'blaster-j.glb', 'blaster-k.glb', 'blaster-l.glb', 'blaster-m.glb', 'blaster-n.glb', 'blaster-o.glb', 'blaster-p.glb', 'blaster-q.glb', 'blaster-r.glb', 'boat-row-large.glb', 'boat-row-small.glb', 'bottle-large.glb', 'bottle.glb', 'box.glb', 'bullet-foam-thick.glb', 'bullet-foam-tip-thick.glb', 'bullet-foam-tip.glb', 'bullet-foam.glb', 'cannon-ball.glb', 'cannon-mobile.glb', 'cannon.glb', 'castle-door.glb', 'castle-gate.glb', 'castle-wall.glb', 'castle-window.glb', 'chest.glb', 'clip-large.glb', 'clip-small.glb', 'cone-flat.glb', 'cone.glb', 'crate-bottles.glb', 'crate-medium.glb', 'crate-small.glb', 'crate-wide.glb', 'crate.glb', 'debris-bolt.glb', 'debris-bumper.glb', 'debris-door-window.glb', 'debris-door.glb', 'debris-drivetrain-axle.glb', 'debris-drivetrain.glb', 'debris-nut.glb', 'debris-plate-a.glb', 'debris-plate-b.glb', 'debris-plate-small-a.glb', 'debris-plate-small-b.glb', 'debris-spoiler-a.glb', 'debris-spoiler-b.glb', 'debris-tire.glb', 'delivery-flat.glb', 'delivery.glb', 'firetruck.glb', 'flag-high-pennant.glb', 'flag-high.glb', 'flag-pennant.glb', 'flag-pirate-high-pennant.glb', 'flag-pirate-high.glb', 'flag-pirate-pennant.glb', 'flag-pirate.glb', 'flag.glb', 'garbage-truck.glb', 'grass-patch.glb', 'grass-plant.glb', 'grass.glb', 'grenade-a.glb', 'grenade-b.glb', 'hatchback-sports.glb', 'hole.glb', 'kart-oobi.glb', 'kart-oodi.glb', 'kart-ooli.glb', 'kart-oopi.glb', 'kart-oozi.glb', 'mast-ropes.glb', 'mast.glb', 'monkey.glb', 'palm-bend.glb', 'palm-detailed-bend.glb', 'palm-detailed-straight.glb', 'palm-straight.glb', 'patch-grass-foliage.glb', 'patch-grass.glb', 'patch-sand-foliage.glb', 'patch-sand.glb', 'platform-planks.glb', 'platform.glb', 'police.glb', 'race-future.glb', 'race.glb', 'rocks-a.glb', 'rocks-b.glb', 'rocks-c.glb', 'rocks-sand-a.glb', 'rocks-sand-b.glb', 'rocks-sand-c.glb', 'scope-large-a.glb', 'scope-large-b.glb', 'scope-small.glb', 'sedan-sports.glb', 'sedan.glb', 'ship-ghost.glb', 'ship-large.glb', 'ship-medium.glb', 'ship-pirate-large.glb', 'ship-pirate-medium.glb', 'ship-pirate-small.glb', 'ship-small.glb', 'ship-wreck.glb', 'silencer-larger.glb', 'silencer-small.glb', 'smoke.glb', 'structure-fence-sides.glb', 'structure-fence.glb', 'structure-platform-dock-small.glb', 'structure-platform-dock.glb', 'structure-platform-small.glb', 'structure-platform.glb', 'structure-roof.glb', 'structure.glb', 'suv-luxury.glb', 'suv.glb', 'target-detail.glb', 'target-fragment-large.glb', 'target-fragment-small.glb', 'target-large.glb', 'target-small.glb', 'taxi.glb', 'tool-paddle.glb', 'tool-shovel.glb', 'tower-base-door.glb', 'tower-base.glb', 'tower-complete-large.glb', 'tower-complete-small.glb', 'tower-middle-windows.glb', 'tower-middle.glb', 'tower-roof.glb', 'tower-top.glb', 'tower-watch.glb', 'tractor-police.glb', 'tractor-shovel.glb', 'tractor.glb', 'truck-flat.glb', 'truck.glb', 'van.glb', 'wheel-dark.glb', 'wheel-default.glb', 'wheel-racing.glb', 'wheel-tractor-back.glb', 'wheel-tractor-dark-back.glb', 'wheel-tractor-dark-front.glb', 'wheel-tractor-front.glb', 'wheel-truck.glb'
]

export const turingPresets: Record<string, { feed: number, kill: number, base: string, peak: string }> = {
    coral:     { feed: 0.055, kill: 0.062, base: '#050d26', peak: '#33e6cc' }, // Ocean/Cyan
    mitosis:   { feed: 0.036, kill: 0.065, base: '#1a0033', peak: '#33ff80' }, // Purple/Neon Green
    chaos:     { feed: 0.026, kill: 0.051, base: '#260d05', peak: '#ff4d00' }, // Magma/Orange
    pulsating: { feed: 0.014, kill: 0.054, base: '#001a1a', peak: '#e6ccff' }, // Dark Teal/Lilac
    holes:     { feed: 0.039, kill: 0.058, base: '#33e6cc', peak: '#050d26' }, // Inverted Coral
    worms:     { feed: 0.078, kill: 0.061, base: '#1a1a1a', peak: '#e6e6e6' }  // Monochromatic
};