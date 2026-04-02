// demos/QuantumCore/geometry.ts

export const MAX_INSTANCES = 25000;
export const STRIDE = 14;

// We store the structural data so we can update the WebGPU buffer per-frame
export interface ParticleState {
    theta: number;
    phi: number;
    radius: number;
    speed: number;
    knotP: number;
    knotQ: number;
}

export function generateCoreData() {
    const data = new Float32Array(MAX_INSTANCES * STRIDE);
    const particleStates: ParticleState[] = [];

    for (let i = 0; i < MAX_INSTANCES; i++) {
        const base = i * STRIDE;

        // Determine which "Ring" of the core this particle belongs to
        const ringId = i % 3;
        let p = 2, q = 3, rBase = 10; // Default Torus Knot parameters

        if (ringId === 0) { p = 3; q = 7; rBase = 8; }  // Inner tight knot
        if (ringId === 1) { p = 2; q = 5; rBase = 15; } // Mid orbiting knot
        if (ringId === 2) { p = 1; q = 8; rBase = 22; } // Outer scattered shell

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 2;

        particleStates.push({
            theta, phi,
            radius: rBase + (Math.random() - 0.5) * 4.0,
            speed: (Math.random() * 0.5 + 0.5) * (ringId % 2 === 0 ? 1 : -1), // Counter-rotating
            knotP: p,
            knotQ: q
        });

        // Scales: Make them look like tech-shards
        data[base + 8] = 0.15; // Sx
        data[base + 9] = 0.15; // Sy
        data[base + 10] = 0.8; // Sz

        // Cybernetic Color Palette (Teal & Hot Gold/Pink)
        const isTeal = Math.random() > 0.5;
        data[base + 11] = isTeal ? 0.1 : 1.0; // R
        data[base + 12] = isTeal ? 1.0 : 0.3; // G
        data[base + 13] = isTeal ? 0.8 : 0.1; // B
    }

    return { data, particleStates };
}