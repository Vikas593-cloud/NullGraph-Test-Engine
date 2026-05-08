// src/ui/sandbox.ts

let editor: any;
let currentEngine: any = null;

const INITIAL_CODE = `
import { NullGraph, Camera } from 'null-graph';
import { Primitives, StandardLayout } from "null-graph/geometry";
import { buildPBRShader, StandardPBRMaterial } from "null-graph/materials";

export async function run(canvas) {
    // 1. 🚨 FIX: Force valid dimensions to prevent Camera Math from returning Infinity!
    const width = canvas.clientWidth || window.innerWidth || 800;
    const height = canvas.clientHeight || window.innerHeight || 600;
    canvas.width = width;
    canvas.height = Math.max(1, height); // Never allow height to be 0

    console.log("[Sandbox] 1. Initializing Engine...");
    const engine = new NullGraph();
    await engine.init(canvas);

    // 2. 🚨 FIX: Catch silent WebGPU validation errors
    if (engine.device) {
        engine.device.addEventListener('uncapturederror', (event) => {
            console.error("WebGPU Validation Error:", event.error.message);
            const errDiv = document.getElementById('error');
            if (errDiv) {
                errDiv.innerHTML = "<b>WebGPU Error:</b><br>" + event.error.message;
                errDiv.style.display = 'block';
            }
        });
    }

    const camera = new Camera(75, canvas.width / canvas.height, 0.1, 1000.0);
    
    const mainPass = engine.createPass({
        name: 'Main Pass',
        isMainScreenPass: true
    });

    console.log("[Sandbox] 2. Uploading Geometry...");
    const cubeGeom = Primitives.createCube(StandardLayout, 2, 2, 2);
    cubeGeom.upload(engine);

    const material = new StandardPBRMaterial(engine, {
        albedoMap: engine.textureManager.fallbackWhite,
        normalMap: engine.textureManager.fallbackNormal,
        packedMap: engine.textureManager.fallbackWhite, 
        packedMapFormat: "ARM",
        baseColor: [0.1, 0.5, 0.9, 1.0], 
        metallicMultiplier: 0.0,
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
    initialData[1] = 0.0; initialData[2] = 0.0; initialData[3] = 0.0; 
    initialData[7] = 1.0;  
    initialData[8] = 1.0; initialData[9] = 1.0; initialData[10] = 1.0; 
    initialData[11] = 1.0; initialData[12] = 1.0; initialData[13] = 1.0; 

    engine.updateBatchData(cubeBatch, initialData, 1);
    console.log("[Sandbox] 3. Pipeline Built.");

    function frame() {
        if (!engine.isDestroyed) {
            const simTime = performance.now() * 0.001;
            camera.updateView(
                [Math.sin(simTime) * 8, 3, Math.cos(simTime) * 8],
                [0, 0, 0] 
            );
            engine.updateCamera(camera);

            engine.render();
            requestAnimationFrame(frame);
        }
    }
    
    console.log("[Sandbox] 4. Starting Render Loop...");
    frame();

    return engine;
}
`.trim();

export async function initMonacoSandbox(editorContainerId: string, previewContainerId: string) {
    // @ts-ignore
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

    // @ts-ignore
    require(['vs/editor/editor.main'], function () {
        // @ts-ignore
        editor = monaco.editor.create(document.getElementById(editorContainerId), {
            value: INITIAL_CODE,
            language: 'typescript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14
        });

        let timer: any;
        editor.onDidChangeModelContent(() => {
            clearTimeout(timer);
            timer = setTimeout(() => executeCode(previewContainerId), 1000);
        });

        setTimeout(() => executeCode(previewContainerId), 500);
    });
}

async function executeCode(previewContainerId: string) {
    const code = editor.getValue();
    const previewContainer = document.getElementById(previewContainerId);

    if (!previewContainer) return;

    previewContainer.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <style>
            body { margin: 0; overflow: hidden; background: #000; }
            canvas { width: 100vw; height: 100vh; display: block; }
            /* 🚨 HIGH CONTRAST ERROR STYLES 🚨 */
            #error { 
                position: absolute; bottom: 10px; left: 10px; right: 10px; 
                color: #ffffff; background: #cc0000; border: 2px solid #ff4d4d;
                padding: 15px; font-family: monospace; display: none; 
                border-radius: 4px; z-index: 1000;
                white-space: pre-wrap; word-break: break-all;
            }
        </style>
        
         <script type="importmap">
        {
          "imports": {
            "null-graph": "https://esm.sh/null-graph@0.0.9",
            "null-graph/geometry": "https://esm.sh/null-graph@0.0.9/geometry",
            "null-graph/materials": "https://esm.sh/null-graph@0.0.9/materials"
          }
        }
        </script>

        <script>
            window.addEventListener('error', (event) => {
                const errDiv = document.getElementById('error');
                errDiv.innerHTML = "<b>JS Error:</b><br>" + (event.message || event.error);
                errDiv.style.display = 'block';
            });
            window.addEventListener('unhandledrejection', (event) => {
                const errDiv = document.getElementById('error');
                errDiv.innerHTML = "<b>Promise Rejected:</b><br>" + (event.reason?.message || event.reason);
                errDiv.style.display = 'block';
            });
        </script>
    </head>
    <body>
        <canvas id="gpuCanvas"></canvas>
        <div id="error"></div>
        
        <script type="module">
            ${code}
            
            if (typeof run === 'function') {
                run(document.getElementById('gpuCanvas')).catch(err => {
                    const errDiv = document.getElementById('error');
                    // 🚨 Force the error to reveal itself, even if it's an obscure object
                    const errorText = err.message || err.toString() || JSON.stringify(err, Object.getOwnPropertyNames(err));
                    errDiv.innerHTML = "<b>Engine Crash:</b><br>" + errorText;
                    errDiv.style.display = 'block';
                });
            }
        </script>
    </body>
    </html>
    `;

    iframe.srcdoc = htmlContent;
    previewContainer.appendChild(iframe);
}