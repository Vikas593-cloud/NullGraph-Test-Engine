import { UIState } from "../types";
import { hexToRGB } from "../utils/helper";
import { turingPresets } from "../data/geometryData";
import { ALL_MANAGED_SLIDERS, demoControlsMap } from "../data/demoRegistryData";

export function initEngineControls(onStateChange: (state: UIState) => void) {
    const state: UIState = {
        timeScale: 0.3, amplitude: 2.0, auraR: 30.0, auraG: 0.0, auraB: 5.0,
        feedRate: 0.055, killRate: 0.062,
        baseColor: [5/255, 13/255, 38/255], peakColor: [51/255, 230/255, 204/255],
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
        peak: getEl('peak-color')
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