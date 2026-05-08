import gsap from 'gsap';
import { DemoId } from "../types";
import { DEMO_DATA } from "../data/documentationData";
import {initMonacoSandbox} from "./sandbox";

export function initNavigation(onDemoChange: (demoId: DemoId) => void) {
    const isMobile = () => window.innerWidth <= 768;
    const sidebar = document.getElementById('sidebar');
    const controlPanel = document.getElementById('control-panel');
    const navItems = document.querySelectorAll('.nav-item');
    const docOverlay = document.getElementById('doc-overlay');
    const docContent = document.getElementById('doc-content');

    // Panel Toggles
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed'); document.body.classList.toggle('left-collapsed');
    });
    document.getElementById('right-panel-toggle')?.addEventListener('click', () => {
        controlPanel?.classList.toggle('collapsed'); document.body.classList.toggle('right-collapsed');
    });

    if (isMobile()) {
        sidebar?.classList.add('collapsed'); document.body.classList.add('left-collapsed');
        controlPanel?.classList.add('collapsed'); document.body.classList.add('right-collapsed');
    }

    // Docs Logic
    async function performFetch(target: string) {
        if (!docContent) return;
        try {
            const response = await fetch(`./docs/${target}.html`);
            if (!response.ok) throw new Error();
            docContent.innerHTML = await response.text();
            gsap.fromTo(docContent, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
        } catch {
            docContent.innerHTML = `<h1>Error 404</h1><p>Module not found.</p>`;
        }
    }

    // 🚨 ADDED RESUME DISPATCH HERE 🚨
    document.getElementById('close-docs')?.addEventListener('click', () => {
        docOverlay?.classList.add('hidden');
        navItems.forEach(nav => nav.classList.remove('active'));
        document.dispatchEvent(new CustomEvent('resume-main-engine'));
    });

    // Nav Click Logic
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            navItems.forEach(nav => nav.classList.remove('active'));
            target.classList.add('active');

            if (target.dataset.target) {
                docOverlay?.classList.remove('hidden');
                if (docContent) {
                    gsap.to(docContent, { opacity: 0, y: 10, duration: 0.2, onComplete: () => {
                            docContent.innerHTML = `<p class="neon">ACCESSING...</p>`;
                            performFetch(target.dataset.target!);
                        }});
                }
            } else if (target.dataset.demo) {
                docOverlay?.classList.add('hidden');
                onDemoChange(target.dataset.demo as DemoId);
            }

            if (isMobile()) {
                sidebar?.classList.add('collapsed'); document.body.classList.add('left-collapsed');
            }
        });
    });

    return {
        updateInfoPanel: (demoId: string) => {
            const container = document.getElementById('demo-info-container');
            const titleEl = document.getElementById('info-title');
            const conceptsEl = document.getElementById('info-concepts');
            const sectionsWrapper = document.getElementById('info-sections-wrapper');

            if (!container || !titleEl || !conceptsEl || !sectionsWrapper) return;

            const data = DEMO_DATA[demoId] || {
                title: "Demo Details",
                concepts: ["WebGPU", "WIP"],
                sections: [
                    {
                        heading: "Documentation Pending",
                        text: "The documentation for this specific demo is currently being written and will be available soon.",
                        isOpen: true
                    }
                ]
            };

            gsap.to(container, {
                opacity: 0, duration: 0.2,
                onComplete: () => {
                    titleEl.innerText = data.title;
                    conceptsEl.innerHTML = data.concepts.map((c: string) => `<span class="tag">${c}</span>`).join('');

                    sectionsWrapper.innerHTML = data.sections.map((sec: any) => `
                        <details class="info-section" ${sec.isOpen ? 'open' : ''}>
                            <summary>${sec.heading}</summary>
                            <div class="section-content">
                                <p>${sec.text}</p>
                                ${sec.code ? `<div class="code-wrapper"><code>${sec.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></div>` : ''}
                            </div>
                        </details>
                    `).join('');

                    if ((window as any).MathJax) {
                        (window as any).MathJax.typesetPromise([sectionsWrapper]).catch((err: any) => console.log('MathJax error:', err));
                    }

                    gsap.to(container, { opacity: 1, duration: 0.2 });
                }
            });
        },
        highlightActiveItem: (demoId: string) => {
            navItems.forEach(nav => {
                nav.classList.remove('active');
                if ((nav as HTMLElement).dataset.demo === demoId) nav.classList.add('active');
            });
        }
    };
}