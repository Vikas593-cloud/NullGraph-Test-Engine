// src/tutorial.ts

import {TUTORIAL_CODES} from "./tutorials-data";

declare const monaco: any;

let editor: any;
let tsModel: any;
let jsModel: any;
let compiledModel: any;
function showError(message: string) {
    const errorLog = document.getElementById('error-log');
    if (errorLog) {
        errorLog.textContent = message;
        errorLog.style.display = 'block';
    }
}

function clearError() {
    const errorLog = document.getElementById('error-log');
    if (errorLog) {
        errorLog.style.display = 'none';
        errorLog.textContent = '';
    }
}

// Listen for messages from the iframe
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'engine-error') {
        showError(event.data.message);
    }
});
let activeMode: 'ts' | 'js' | 'compiled' = 'ts';

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const tutorialId = urlParams.get('id') || 'tutorial-hello-world';

    // Fallbacks if data is missing
    const tutorialData = TUTORIAL_CODES[tutorialId] || { ts: "// No TS found", js: "// No JS found" };

    // @ts-ignore
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

    // @ts-ignore
    require(['vs/editor/editor.main'], async function () {

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            allowNonTsExtensions: true
        });

        // Create THREE models
        tsModel = monaco.editor.createModel(tutorialData.ts, 'typescript', monaco.Uri.parse('file:///main.ts'));
        jsModel = monaco.editor.createModel(tutorialData.js, 'javascript', monaco.Uri.parse('file:///main.js'));
        compiledModel = monaco.editor.createModel('// Compiled Output...', 'javascript', monaco.Uri.parse('file:///compiled.js'));

        editor = monaco.editor.create(document.getElementById('editor-container'), {
            model: tsModel,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 15 }
        });

        const tabTs = document.getElementById('tab-ts');
        const tabJs = document.getElementById('tab-js');
        const tabCompiled = document.getElementById('tab-compiled');

        const updateTabs = (activeTab: HTMLElement) => {
            [tabTs, tabJs, tabCompiled].forEach(t => t?.classList.remove('active'));
            activeTab.classList.add('active');
        };

        // Switch to main.ts
        tabTs?.addEventListener('click', () => {
            activeMode = 'ts';
            updateTabs(tabTs);
            editor.setModel(tsModel);
            editor.updateOptions({ readOnly: false });
            compileAndRun(); // Boot the TS version
        });

        // Switch to main.js
        tabJs?.addEventListener('click', () => {
            activeMode = 'js';
            updateTabs(tabJs);
            editor.setModel(jsModel);
            editor.updateOptions({ readOnly: false });
            executeInIframe(jsModel.getValue()); // Boot the JS version
        });

        // Switch to compiled.js
        tabCompiled?.addEventListener('click', () => {
            activeMode = 'compiled';
            updateTabs(tabCompiled);
            editor.setModel(compiledModel);
            editor.updateOptions({ readOnly: true });
            // Don't re-run the iframe, just let them read the code
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            if (activeMode === 'ts') compileAndRun();
            if (activeMode === 'js') executeInIframe(jsModel.getValue());
        });

        let timer: any;
        editor.onDidChangeModelContent(() => {
            clearTimeout(timer);
            // Only auto-run if they edit the currently active sandbox
            if (activeMode === 'ts' && editor.getModel() === tsModel) {
                timer = setTimeout(() => compileAndRun(), 1200);
            } else if (activeMode === 'js' && editor.getModel() === jsModel) {
                timer = setTimeout(() => executeInIframe(jsModel.getValue()), 1200);
            }
        });

        // Initial run
        setTimeout(() => compileAndRun(), 500);
    });
}

async function compileAndRun() {
    try {
        clearError(); // <-- ADD THIS to clear the red box on a fresh run

        // @ts-ignore
        const worker = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await worker(tsModel.uri);
        const emitOutput = await client.getEmitOutput(tsModel.uri.toString());

        let compiledJS = "";
        if (emitOutput.outputFiles && emitOutput.outputFiles.length > 0) {
            compiledJS = emitOutput.outputFiles[0].text;
        } else {
            compiledJS = tsModel.getValue();
        }

        compiledModel.setValue(compiledJS);
        executeInIframe(compiledJS);

    } catch (err: any) {
        // <-- UPDATE THIS to show the error in the UI
        showError("Compilation error:\n" + (err.message || err));
    }
}

function executeInIframe(javascriptCode: string) {
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) return;

    // Clear previous errors whenever we restart
    clearError();

    const oldIframe = previewContainer.querySelector('iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <style>body { margin: 0; overflow: hidden; background: #000; } canvas { display: block; width: 100vw; height: 100vh; }</style>
        
        <!-- INTERCEPT ERRORS AND SEND TO PARENT -->
        <script>
            // 1. Catch unhandled syntax/runtime errors
            window.onerror = function(msg, url, line) {
                window.parent.postMessage({ type: 'engine-error', message: "Runtime Error:\\n" + msg + "\\nLine: " + line }, '*');
                return true;
            };
            
            // 2. Catch unhandled promises
            window.addEventListener("unhandledrejection", function(event) {
                window.parent.postMessage({ type: 'engine-error', message: "Engine Crash:\\n" + event.reason }, '*');
            });

            // 3. NEW: Catch things sent directly to console.error (like your main().catch block)
            const originalConsoleError = console.error;
            console.error = function(...args) {
                // Convert arguments to a single string
                const msg = args.map(a => typeof a === 'object' && a instanceof Error ? a.message : String(a)).join(' ');
                window.parent.postMessage({ type: 'engine-error', message: "Console Error:\\n" + msg }, '*');
                originalConsoleError.apply(console, args);
            };
        </script>

        <script type="importmap">
        { "imports": { "null-graph": "https://esm.sh/null-graph@1.0.1", "null-graph/geometry": "https://esm.sh/null-graph@1.0.1/geometry", "null-graph/materials": "https://esm.sh/null-graph@1.0.1/materials" ,"null-graph/profiler": "https://esm.sh/null-graph@1.0.1/profiler","null-graph/debug-ui": "https://esm.sh/null-graph@1.0.1/debug-ui"} }
        </script>
    </head>
    <body>
        <canvas id="gpuCanvas"></canvas>
        <script type="module">
            ${javascriptCode}
        </script>
    </body>
    </html>`;

    iframe.srcdoc = htmlContent;
    previewContainer.appendChild(iframe);
}

// Add this inside your init() function, or at the bottom of the file
function setupResizer() {
    const resizer = document.querySelector('.pane-resizer') as HTMLElement;
    const leftPane = document.querySelector('.pane-left') as HTMLElement;
    const rightPane = document.querySelector('.pane-right') as HTMLElement;
    const workspace = document.querySelector('.workspace') as HTMLElement;

    if (!resizer || !leftPane || !rightPane || !workspace) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        // Prevent iframe from capturing mouse events while dragging
        rightPane.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Calculate the new width based on mouse position
        const workspaceRect = workspace.getBoundingClientRect();
        // Subtracting the left offset of the workspace in case there's an activity bar
        let newLeftWidth = e.clientX - workspaceRect.left;

        // Keep the resizer within reasonable bounds (min 200px width for panes)
        if (newLeftWidth < 200) newLeftWidth = 200;
        if (newLeftWidth > workspaceRect.width - 200) newLeftWidth = workspaceRect.width - 200;

        const leftPercentage = (newLeftWidth / workspaceRect.width) * 100;
        const rightPercentage = 100 - leftPercentage;

        leftPane.style.width = `${leftPercentage}%`;
        rightPane.style.width = `${rightPercentage}%`;

        // Tell Monaco editor to redraw to fit the new layout
        if (editor) {
            editor.layout();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            // Restore iframe pointer events
            rightPane.style.pointerEvents = 'auto';
        }
    });
}

// Call it
setupResizer();
init();