import gsap from 'gsap';
export interface UIState {
    timeScale: number;
    amplitude: number;
}
export function initUI(
    onStateChange: (state: UIState) => void,
    onDemoChange: (demoId: string) => void
) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const navItems = document.querySelectorAll('.nav-item');
    const docOverlay = document.getElementById('doc-overlay');
    const docContent = document.getElementById('doc-content');

    // 1. Sidebar Collapse Logic
    toggleBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
    });

    // 2. Dynamic Fetch Logic for Documentation
    async function loadDocumentation(fileName: string) {
        if (!docContent) return;

        docContent.innerHTML = `<div class="doc-view"><p>Loading...</p></div>`; // Simple loading state

        try {
            // Note: Adjust path if you are using Vite, usually '/docs/' works.
            const response = await fetch(`./docs/${fileName}.html`);
            if (!response.ok) throw new Error(`Could not find ${fileName}.html`);

            const html = await response.text();
            docContent.innerHTML = html;
        } catch (error) {
            console.error(error);
            docContent.innerHTML = `
                <div class="doc-view">
                    <h1>Error 404</h1>
                    <p>Documentation file not found.</p>
                </div>`;
        }
    }

    // 3. Navigation Click Logic
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            navItems.forEach(nav => nav.classList.remove('active'));
            target.classList.add('active');

            if (target.dataset.target) {
                docOverlay?.classList.remove('hidden');
                loadDocumentation(target.dataset.target);
            }
            else if (target.dataset.demo) {
                docOverlay?.classList.add('hidden');
                if (window.innerWidth < 1200) sidebar?.classList.add('collapsed');

                const demoName = target.dataset.demo;
                // Trigger the callback to main.ts!
                onDemoChange(demoName);
            }
        });
    });

    // Load initial page
    loadDocumentation('intro');
    const state: UIState = {
        timeScale: 1.0,
        amplitude: 5.0
    };

    const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
    const speedVal = document.getElementById('speed-val');

    const ampSlider = document.getElementById('amp-slider') as HTMLInputElement;
    const ampVal = document.getElementById('amp-val');

    speedSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (speedVal) speedVal.innerText = val.toFixed(1);
        state.timeScale = val;
        onStateChange(state); // Tell main.ts the state changed
    });

    ampSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (ampVal) ampVal.innerText = val.toFixed(1);
        state.amplitude = val;
        onStateChange(state); // Tell main.ts the state changed
    });

    return {
        updateFPS: (fps: number) => {
            const fpsDisplay = document.getElementById('ui-fps');
            if (fpsDisplay) fpsDisplay.innerText = fps.toString();
        }
    };
}