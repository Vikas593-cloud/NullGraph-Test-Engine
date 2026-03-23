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