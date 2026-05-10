import { UIState } from "../types";
import { hexToRGB } from "../utils/helper";
import { turingPresets } from "../data/geometryData";
import { ALL_MANAGED_SLIDERS, demoControlsMap } from "../data/demoRegistryData";

export function initEngineControls(onStateChange: (state: UIState) => void) {
    let state: UIState = {
        // Existing defaults
        timeScale: 0.3,
        amplitude: 2.0,
        auraR: 30.0,
        auraG: 0.0,
        auraB: 5.0,

        // Morphogenesis
        feedRate: 0.055,
        killRate: 0.062,
        baseColor: [5/255, 13/255, 38/255],
        peakColor: [51/255, 230/255, 204/255],

        // Gyroid defaults
        coreColor: [0.0, 0.8, 1.0],     // Cyan Base
        exciteColor: [1.0, 0.2, 0.5],   // Hot Pink for high velocity
        fractureColor: [3.0, 2.0, 0.5], // Blinding gold near mouse (HDR values)

        // Aetherial Flow
        curveColor :[0.0, 1.0, 0.7],
        fastColor:[1.0, 0.0, 0.8],
        pulseColor:[0.2, 0.2, 0.5],

        // Singularity
        coolColor :[0.05, 0.0, 0.2],
        hotColor:[0.0, 0.8, 1.0],
        coreSingularityColor:[1.0, 0.9, 0.8],

        wantsRestart: false
    };

    // DOM Elements
    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const getValEl = (id: string) => document.getElementById(id);

    const sliders = {
        speed: { in: getEl('speed-slider'), val: getValEl('speed-val') },
        amp: { in: getEl('amp-slider'), val: getValEl('amp-val') },
        r: { in: getEl('r-slider'), val: getValEl('r-val') },
        g: { in: getEl('g-slider'), val: getValEl('g-val') },
        b: { in: getEl('b-slider'), val: getValEl('b-val') },
        feed: { in: getEl('feed-slider'), val: getValEl('feed-val') },
        kill: { in: getEl('kill-slider'), val: getValEl('kill-val') },
        base: getEl('base-color'),
        peak: getEl('peak-color'),

        // NEW: Gyroid Color Pickers
        core: getEl('core-color'),
        excite: getEl('excite-color'),
        fracture: getEl('fracture-color'),

        // -- Aether Params---
        curve: getEl('curve-color'),
        fast: getEl('fast-color'),
        pulse: getEl('pulse-color'),

        // -- Singularity
        cool: getEl('cool-color'),
        hot: getEl('hot-color'),
        coreSingularity: getEl('core-singularity-color'),
    };

    const presetSelect = document.getElementById('pattern-preset') as HTMLSelectElement | null;
    const restartBtn = document.getElementById('btn-restart');

    const updateState = () => {
        if (sliders.speed.in && sliders.speed.val) {
            state.timeScale = parseFloat(sliders.speed.in.value);
            sliders.speed.val.innerText = `${state.timeScale.toFixed(1)}x`;
        }
        if (sliders.amp.in && sliders.amp.val) {
            state.amplitude = parseFloat(sliders.amp.in.value);
            sliders.amp.val.innerText = state.amplitude.toFixed(1);
        }
        if (sliders.r.in && sliders.r.val) { state.auraR = parseFloat(sliders.r.in.value); sliders.r.val.innerText = state.auraR.toFixed(1); }
        if (sliders.g.in && sliders.g.val) { state.auraG = parseFloat(sliders.g.in.value); sliders.g.val.innerText = state.auraG.toFixed(1); }
        if (sliders.b.in && sliders.b.val) { state.auraB = parseFloat(sliders.b.in.value); sliders.b.val.innerText = state.auraB.toFixed(1); }
        if (sliders.feed.in && sliders.feed.val) { state.feedRate = parseFloat(sliders.feed.in.value); sliders.feed.val.innerText = state.feedRate.toFixed(3); }
        if (sliders.kill.in && sliders.kill.val) { state.killRate = parseFloat(sliders.kill.in.value); sliders.kill.val.innerText = state.killRate.toFixed(3); }

        if (sliders.base) state.baseColor = hexToRGB(sliders.base.value);
        if (sliders.peak) state.peakColor = hexToRGB(sliders.peak.value);

        // NEW: Update Gyroid Colors
        if (sliders.core) state.coreColor = hexToRGB(sliders.core.value);
        if (sliders.excite) state.exciteColor = hexToRGB(sliders.excite.value);
        if (sliders.fracture) {
            const fracBase = hexToRGB(sliders.fracture.value);
            // Multiply by 3 to maintain the HDR/bloom intensity since standard color pickers cap at 1.0
            state.fractureColor = [fracBase[0] * 3.0, fracBase[1] * 3.0, fracBase[2] * 3.0];
        }

        // --Aether --
        if (sliders.curve) state.curveColor = hexToRGB(sliders.curve.value);
        if (sliders.fast) state.fastColor = hexToRGB(sliders.fast.value);
        if (sliders.pulse) state.pulseColor = hexToRGB(sliders.pulse.value);

        // --Singularity
        if (sliders.cool) state.coolColor = hexToRGB(sliders.cool.value);
        if (sliders.hot) state.hotColor = hexToRGB(sliders.hot.value);
        if (sliders.coreSingularity) state.coreSingularityColor = hexToRGB(sliders.coreSingularity.value);
        onStateChange(state);
    };

    // Attach Listeners
    Object.values(sliders).forEach(s => {
        if (s && 'in' in s) s.in?.addEventListener('input', updateState);
        else if (s instanceof HTMLInputElement) s.addEventListener('input', updateState);
    });

    restartBtn?.addEventListener('click', () => { state.wantsRestart = true; onStateChange(state); });

    presetSelect?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'custom') return;
        const preset = turingPresets[val];
        if (preset && sliders.feed.in && sliders.kill.in && sliders.base && sliders.peak) {
            sliders.feed.in.value = preset.feed.toString();
            sliders.kill.in.value = preset.kill.toString();
            sliders.base.value = preset.base;
            sliders.peak.value = preset.peak;
            state.wantsRestart = true;
            updateState();
        }
    });

    return {
        updateVisibility: (demoId: string) => {
            ALL_MANAGED_SLIDERS.forEach(sliderId => {
                const slider = document.getElementById(sliderId);
                const group = slider?.closest('.control-group') as HTMLElement | null;
                if (group) group.style.display = 'none';
            });

            const activeControls = demoControlsMap[demoId] || [];
            activeControls.forEach(sliderId => {
                const slider = document.getElementById(sliderId);
                const group = slider?.closest('.control-group') as HTMLElement | null;
                if (group) group.style.display = 'block';
            });

            const engineContainer = document.getElementById('engine-controls-container');
            if (engineContainer) {
                engineContainer.style.display = activeControls.length > 0 ? 'block' : 'none';
            }

            document.querySelectorAll('.panel-divider').forEach(divider => {
                (divider as HTMLElement).style.display = activeControls.length > 0 ? 'block' : 'none';
            });
        }
    };
}