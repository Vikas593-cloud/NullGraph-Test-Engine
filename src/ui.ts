import gsap from 'gsap';
import {DEMO_DATA, UIState} from "./types";




export function initUI(
    onStateChange: (state: UIState) => void,
    onDemoChange: (demoId: string) => void
) {
    // Left Sidebar Elements
    const sidebar = document.getElementById('sidebar');
    const leftToggleBtn = document.getElementById('sidebar-toggle');

    // Right Panel Elements
    const controlPanel = document.getElementById('control-panel');
    const rightToggleBtn = document.getElementById('right-panel-toggle');

    const navItems = document.querySelectorAll('.nav-item');
    const docOverlay = document.getElementById('doc-overlay');
    const docContent = document.getElementById('doc-content');

    const isMobile = () => window.innerWidth <= 768;

    // --- Panel Toggle Logic ---
    leftToggleBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
        document.body.classList.toggle('left-collapsed');
    });

    rightToggleBtn?.addEventListener('click', () => {
        controlPanel?.classList.toggle('collapsed');
        document.body.classList.toggle('right-collapsed');
    });



    // Auto-collapse on mobile load
    if (isMobile()) {
        sidebar?.classList.add('collapsed');
        document.body.classList.add('left-collapsed');

        controlPanel?.classList.add('collapsed');
        document.body.classList.add('right-collapsed');
    }

    // --- Documentation Fetching ---
    async function performFetch(target: string) {
        if (!docContent) return;
        try {
            const response = await fetch(`./docs/${target}.html`);
            if (!response.ok) throw new Error();
            const html = await response.text();

            docContent.innerHTML = html;
            gsap.fromTo(docContent, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
        } catch {
            docContent.innerHTML = `<h1>Error 404</h1><p>Module not found.</p>`;
        }
    }

    function loadDocumentation(target: string) {
        if (!docContent) return;
        gsap.to(docContent, {
            opacity: 0,
            y: 10,
            duration: 0.2,
            onComplete: () => {
                docContent.innerHTML = `<p class="neon">ACCESSING...</p>`;
                performFetch(target);
            }
        });
    }
    // --- Close Docs Logic ---
    const closeDocsBtn = document.getElementById('close-docs');

    closeDocsBtn?.addEventListener('click', () => {
        // 1. Hide the documentation overlay
        docOverlay?.classList.add('hidden');

        // 2. Remove the 'active' highlight from the sidebar navigation
        navItems.forEach(nav => nav.classList.remove('active'));
    });

    function updateRightPanelInfo(demoId: string) {
        const container = document.getElementById('demo-info-container');
        const titleEl = document.getElementById('info-title');
        const conceptsEl = document.getElementById('info-concepts');
        const sectionsWrapper = document.getElementById('info-sections-wrapper');

        if (!container || !titleEl || !conceptsEl || !sectionsWrapper) return;

        // Fallback data
        const data = DEMO_DATA[demoId] || {
            title: "Demo Details",
            concepts: ["WebGPU"],
            sections: [{ heading: "Pending", text: "Documentation is being written." }]
        };

        gsap.to(container, {
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
                // Update Title and Tags
                titleEl.innerText = data.title;
                conceptsEl.innerHTML = data.concepts.map(c => `<span class="tag">${c}</span>`).join('');

                // Generate HTML for Accordions
                let sectionsHTML = '';
                data.sections.forEach(sec => {
                    const openAttr = sec.isOpen ? 'open' : '';
                    let codeBlock = '';
                    if (sec.code) {
                        // Using a simple replace to escape basic HTML chars in code
                        const safeCode = sec.code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        codeBlock = `<div class="code-wrapper"><code>${safeCode}</code></div>`;
                    }

                    sectionsHTML += `
                        <details class="info-section" ${openAttr}>
                            <summary>${sec.heading}</summary>
                            <div class="section-content">
                                <p>${sec.text}</p>
                                ${codeBlock}
                            </div>
                        </details>
                    `;
                });

                sectionsWrapper.innerHTML = sectionsHTML;

                // Fade back in
                gsap.to(container, { opacity: 1, duration: 0.2 });
            }
        });
    }
    // --- Navigation Logic ---
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
                const demoId = target.dataset.demo;
                onDemoChange(demoId);
                updateRightPanelInfo(demoId);
            }

            if (isMobile()) {
                sidebar?.classList.add('collapsed');
                document.body.classList.add('left-collapsed');
            }
        });
    });

    // --- Slider Logic ---
    const state: UIState = { timeScale: 0.3, amplitude: 2.0 };
    const speedSlider = document.getElementById('speed-slider') as HTMLInputElement | null;
    const speedVal = document.getElementById('speed-val');
    const ampSlider = document.getElementById('amp-slider') as HTMLInputElement | null;
    const ampVal = document.getElementById('amp-val');

    const updateState = () => {
        if (speedSlider && speedVal) {
            const val = parseFloat(speedSlider.value);
            speedVal.innerText = `${val.toFixed(1)}x`;
            state.timeScale = val;
        }
        if (ampSlider && ampVal) {
            const val = parseFloat(ampSlider.value);
            ampVal.innerText = val.toFixed(1);
            state.amplitude = val;
        }
        onStateChange(state);
    };

    speedSlider?.addEventListener('input', updateState);
    ampSlider?.addEventListener('input', updateState);


    return {
        updateFPS: (fps: number) => {
            const fpsDisplay = document.getElementById('ui-fps');
            if (fpsDisplay) fpsDisplay.innerText = Math.round(fps).toString();
        }
    };
}