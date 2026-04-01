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

// Note: Your existing `cubeIndices` remain exactly the same!
// UVs don't change how the vertices connect to form triangles.