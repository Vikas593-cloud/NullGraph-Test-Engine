import {cymaticDocumentation} from "./demos/WebGPUExperiments/CymaticResonance/Documentation";
import {deferredRenderingDocumentation} from "./demos/WebGPUExperiments/DeferredRendering/Documentation";
import {implicitScreensaverDocumentation} from "./demos/WebGPUExperiments/ImplicitScreensaver/Documentation";
import {quantumCoreDocumentation} from "./demos/WebGPUExperiments/QuantumCore/Documentation";
import {singularityDocumentation} from "./demos/WebGPUExperiments/Singularity/Documentation";
import {aetherialFlowDocumentation} from "./demos/WebGPUExperiments/AetherialFlow/Documentation";
import {quantumNebulaDocumentation} from "./demos/WebGPUExperiments/QuantumNebula/Documentation";
import {gyroidResonanceDocumentation} from "./demos/WebGPUExperiments/GyroidResonance/Documentation";
import {etherealGyroidDocumentation} from "./demos/WebGPUExperiments/EtherealGyroid/Documentation";
import {stellaratorFluxDocumentation} from "./demos/WebGPUExperiments/StellaratorFlux/Documentation";
import {hopfFibrationDocumentation} from "./demos/WebGPUExperiments/HopfFibration/Documentation";
import {aizawaCanvasDocumentation} from "./demos/WebGPUExperiments/AizawaCanvas/Documentation";
import {iridescentLeviathanDocumentation} from "./demos/WebGPUExperiments/IridescentLeviathan/Documentation";
import {morphogenesisDocumentation} from "./demos/WebGPUExperiments/Morphogenesis-Alan-Turing-1952/Documentation";

export interface UIState {
    timeScale: number;
    amplitude: number;
}
export interface DemoSection {
    heading: string;
    text: string;  // Can include HTML like <strong> or inline <code>
    code?: string; // Optional code block
    isOpen?: boolean; // Should this section be open by default?
}

export interface DemoMetadata {
    title: string;
    concepts: string[];
    sections: DemoSection[];
}


// 2. Populate with deep, rich content
export const DEMO_DATA: Record<string, DemoMetadata> = {
    "demo-crt-effect": {
        title: "CRT Monitor Simulation",
        concepts: ["Post-Processing", "UV Distortion", "Chromatic Aberration"],
        sections: [
            {
                heading: "Overview",
                isOpen: true,
                text: "This demo uses a full-screen quad to run a post-processing pass over the rendered scene. We manipulate the <code>UV coordinates</code> to simulate the curvature and color bleeding of vintage cathode-ray tube displays."
            },
            {
                heading: "UV Curvature",
                text: "Before sampling the texture, we distort the UVs. By calculating the distance from the center, we push the corners outward.",
                code: `// UV Curvature distortion
fn curve(uv: vec2<f32>) -> vec2<f32> {
  var new_uv = uv * 2.0 - 1.0;
  let offset = abs(new_uv.yx) / vec2<f32>(4.0, 4.0);
  new_uv = new_uv + new_uv * offset * offset;
  return new_uv * 0.5 + 0.5;
}`
            },
            {
                heading: "Chromatic Aberration",
                text: "Instead of sampling the texture once, we sample the Red, Green, and Blue channels at slightly different UV offsets to create color separation at the edges."
            }
        ]
    },
    "demo-cymatic-resonance":cymaticDocumentation,
    "demo-deferred-rendering":deferredRenderingDocumentation,
    "demo-implicit-screen-saver":implicitScreensaverDocumentation,
    "demo-quantumcore":quantumCoreDocumentation,
    "demo-singularity":singularityDocumentation,
    "demo-aetherial-flow":aetherialFlowDocumentation,
    "demo-quantum-nebula":quantumNebulaDocumentation,
     "demo-gyroid-resonance":gyroidResonanceDocumentation,
    "demo-ethereal-gyroid":etherealGyroidDocumentation,
     "demo-stellarator-flux":stellaratorFluxDocumentation,
     "demo-hopffibration":hopfFibrationDocumentation,
    "demo-aizawa-canvas":aizawaCanvasDocumentation,
    "demo-iridescent-leviathan":iridescentLeviathanDocumentation,
    "demo-morphogenesis-diffusion":morphogenesisDocumentation
};