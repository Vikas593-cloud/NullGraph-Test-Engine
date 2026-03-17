import { NullGraph, Camera } from 'null-graph';

async function main() {
    const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 1. Initialize Engine from the npm package
    const engine = new NullGraph();
    await engine.init(canvas);

    // 2. Initialize Camera
    const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);

    // 3. Generate Dummy ECS Data (Matches your 14-float stride)
    const entityCount = 10000;
    const stride = 14;
    const dummyEcsData = new Float32Array(entityCount * stride);

    for (let i = 0; i < entityCount; i++) {
        const base = i * stride;
        dummyEcsData[base + 0] = i; // ID

        // POS
        dummyEcsData[base + 1] = (Math.random() - 0.5) * 100;
        dummyEcsData[base + 2] = (Math.random() - 0.5) * 100;
        dummyEcsData[base + 3] = (Math.random() - 0.5) * 100;

        // SCALE
        dummyEcsData[base + 8] = Math.random() * 2 + 0.5;
        dummyEcsData[base + 9] = Math.random() * 2 + 0.5;
        dummyEcsData[base + 10] = Math.random() * 2 + 0.5;

        // COLOR
        dummyEcsData[base + 11] = Math.random(); // R
        dummyEcsData[base + 12] = Math.random(); // G
        dummyEcsData[base + 13] = Math.random(); // B
    }

    // Push entities to GPU Storage Buffer
    engine.updateEntities(dummyEcsData, entityCount);

    // 4. Render Loop
    let time = 0;
    function frame() {
        time += 0.01;

        // Spin camera around the origin
        const radius = 80;
        const camX = Math.sin(time) * radius;
        const camZ = Math.cos(time) * radius;
        camera.updateView([camX, 20, camZ], [0, 0, 0]);

        // Push uniform updates and draw
        engine.updateCamera(camera);
        engine.render();

        requestAnimationFrame(frame);
    }

    frame();

    // Basic resize handler
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

main().catch(console.error);