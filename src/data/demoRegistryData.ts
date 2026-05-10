import {setupAoS} from "../demos/AoSExample";
import {setupSoA} from "../demos/SoAExample";
import {setupSceneGraph} from "../demos/SceneGraphExample";
import {setupAoSoA} from "../demos/AoSoAExample";
import {setup3DCube} from "../demos/3DGeometryExample";
import {setup3DCubeWithAmbientLight} from "../demos/3DGeometryWithLighting";
import {setupSpaceFleet} from "../demos/SpaceFleetExample";
import {setupFireworks} from "../demos/FireWorksExample";
import {setupGPUCulling} from "../demos/GPUCullingExample";
import {setupGPULOD} from "../demos/GPULodExample";
import {setupMegabuffer} from "../demos/MegaBufferExample";
import {setupForwardLightingCyberPunk2077} from "../demos/ForwardLightingCyberPunk2077";
import {setupPostProcessing} from "../demos/PostProcessing";
import {setupCRTEffect} from "../demos/CRTEffect";
import {setupBloomEffect} from "../demos/BloomEffectExample";
import {setupHologramEffect} from "../demos/HologramEffectExample";
import {setupSynthwaveCRT} from "../demos/SynthwaveCRTExample";
import {setupQuantumCoreDemo} from "../demos/WebGPUExperiments/QuantumCore";
import {setupSingularity} from "../demos/WebGPUExperiments/Singularity";
import {setupAetherialFlow} from "../demos/WebGPUExperiments/AetherialFlow";
import {setupGyroidResonance} from "../demos/WebGPUExperiments/GyroidResonance";
import {setupAizawaCanvas} from "../demos/WebGPUExperiments/AizawaCanvas";
import {setupIridescentLeviathan} from "../demos/WebGPUExperiments/IridescentLeviathan";
import {setupLabyrinthChaos} from "../demos/WebGPUExperiments/LabyrinthChaos";
import {setupEtherealGyroid} from "../demos/WebGPUExperiments/EtherealGyroid";
import {setupStellaratorFlux} from "../demos/WebGPUExperiments/StellaratorFlux";
import {setupHopfFibration} from "../demos/WebGPUExperiments/HopfFibration";
import {setupQuantumNebula} from "../demos/WebGPUExperiments/QuantumNebula";
import {setupCymaticResonance} from "../demos/WebGPUExperiments/CymaticResonance";
import {setupDeferredRendering} from "../demos/WebGPUExperiments/DeferredRendering";
import {setupImplicitScreensaver} from "../demos/WebGPUExperiments/ImplicitScreensaver";
import {setupMorphogenesisAlanTuring1952} from "../demos/WebGPUExperiments/Morphogenesis-Alan-Turing-1952";
import {Camera, NullGraph} from "null-graph";
import {setupAxionEngineLoop} from "../demos/AxionEngineLoop/AxionEngineLoopExample";
import {generateProceduralAsteroid} from "./geometryData";
import {CustomDemoContext} from "../types";
import {setupEpicSwarm} from "../demos/3DModelsExperiments/EpicSwarm";
import {setupGLBLoaderExample} from "../demos/3DModelsExperiments/GLBLoader/GLBLoaderExample";
import {setupPBRTest} from "../demos/3DPBRExperiments/PBRMonkey";
import {setupAetherialMonkeyFlow} from "../demos/3DPBRExperiments/AetherialMonkeyFlow";
import {setupBreakdanceGirl} from "../demos/3DAnimatedModelExperiments/Breakdance";
import {setupMixamoModel} from "../demos/3DPBRExperiments/MixamoModelGirl";
import {setupAnimationwithPostProcessing} from "../demos/3DAnimatedModelExperiments/AnimationPostProcessing";

export const demoRegistry = {
    // --- BASIC DEMOS ---
    'demo-aos': { setup: setupAoS },
    'demo-soa': { setup: setupSoA },
    'demo-oop': { setup: setupSceneGraph },
    'demo-aosoa': { setup: setupAoSoA },

    'demo-3d-cube': { setup: setup3DCube },
    'demo-3d-cube-ambient-light': { setup: setup3DCubeWithAmbientLight },
    'demo-spacefleet': { setup: setupSpaceFleet },
    'demo-fireworks': { setup: setupFireworks },
    'demo-gpu-culling': { setup: setupGPUCulling },
    'demo-gpu-lod': { setup: setupGPULOD },
    'demo-mega-buffer': { setup: setupMegabuffer },
    'demo-forward+-lighting': { setup: setupForwardLightingCyberPunk2077 },
    'demo-post-processing': { setup: setupPostProcessing },
    'demo-crt-effect': { setup: setupCRTEffect },

    //---3D MODELS
    'demo-glb-loader':{setup:setupGLBLoaderExample},
    'demo-epic-swarm':{setup:setupEpicSwarm,camera:true},

    //----PBR Materials-----
    'demo-pbr-test':{setup:setupPBRTest,camera:true},
    'demo-aetherial-monkey-flow':{setup:setupAetherialMonkeyFlow,camera:true},
    'demo-mixamo-model':{setup:setupMixamoModel,camera:true},
    'demo-animation-postprocessing':{setup:setupAnimationwithPostProcessing,camera:true},
    // --- EFFECT DEMOS ---
    'demo-bloom-effect': { setup: setupBloomEffect },
    'demo-hologram-effect': { setup: setupHologramEffect },
    'demo-synthwave-crt-effect': { setup: setupSynthwaveCRT },
    //----3D Animation Demos ---
    'demo-simple-butterfly':{setup:setupBreakdanceGirl,camera:true},

    // --- WEBGPU EXPERIMENTS (camera update) ---
    'demo-quantumcore': { setup: setupQuantumCoreDemo, camera: true },
    'demo-singularity': { setup: setupSingularity, camera: true },
    'demo-aetherial-flow': { setup: setupAetherialFlow, camera: true },
    'demo-gyroid-resonance': { setup: setupGyroidResonance, camera: true },
    'demo-aizawa-canvas': { setup: setupAizawaCanvas, camera: true },
    'demo-iridescent-leviathan': { setup: setupIridescentLeviathan, camera: true },
    'demo-labyrinth-chaos': { setup: setupLabyrinthChaos, camera: true },
    'demo-ethereal-gyroid': { setup: setupEtherealGyroid, camera: true },
    'demo-stellarator-flux': { setup: setupStellaratorFlux, camera: true },
    'demo-hopffibration': { setup: setupHopfFibration, camera: true },
    'demo-quantum-nebula': { setup: setupQuantumNebula, camera: true },
    'demo-cymatic-resonance': { setup: setupCymaticResonance, camera: true },
    'demo-deferred-rendering': { setup: setupDeferredRendering, camera: true },
    'demo-implicit-screen-saver': { setup: setupImplicitScreensaver, camera: true },
    'demo-morphogenesis-diffusion': { setup: setupMorphogenesisAlanTuring1952, camera: true },

    // --- SPECIAL CASE ---
    'demo-axion-engine-loop': {
        custom: async (engine:NullGraph, camera:Camera, getState: () => { amplitude: number }, ctx:CustomDemoContext) => {
            const demo = await setupAxionEngineLoop(engine, camera, getState);

            if(!demo)return;
            ctx.activeUpdateLoop = demo.update;

            let isMeshActive = false;
            let currentMeshName = "";
            let generationCount = 0;

            const intervalId = window.setInterval(() => {
                if (isMeshActive) {
                    demo.removeGeometryMidFlight(currentMeshName);
                    isMeshActive = false;
                } else {
                    generationCount++;
                    currentMeshName = `Procedural_Stream_${generationCount}`;

                    const randomSides = Math.floor(Math.random() * 22) + 3;
                    const isCrystal = Math.random() > 0.5;
                    const randomRadius = 1.0 + Math.random() * 2.0;

                    const dynamicMesh = generateProceduralAsteroid(
                        randomSides,
                        randomRadius,
                        isCrystal
                    );

                    const r = Math.random() > 0.5 ? 1.0 : Math.random();
                    const g = Math.random() > 0.5 ? 1.0 : Math.random();
                    const b = Math.random() > 0.5 ? 1.0 : Math.random();

                    demo.addNewGeometryMidFlight(
                        currentMeshName,
                        dynamicMesh,
                        [r, g, b],
                        15
                    );

                    isMeshActive = true;
                }
            }, 2000);

            ctx.activeDestroyFunc = () => {
                window.clearInterval(intervalId);
                demo.destroy();
            };
        }
    }
};

export const demoControlsMap: Record<string, string[]> = {
    // --- Architecture Demos
    'demo-aos':['speed-slider','amp-slider'],
    'demo-aosoa':['speed-slider','amp-slider'],
    'demo-soa':['speed-slider','amp-slider'],
    'demo-oop':['speed-slider','amp-slider'],
    // --- 3D Geometry Examples ---
    'demo-3d-cube': ['amp-slider','speed-slider'],
    'demo-3d-cube-ambient-light': ['amp-slider','speed-slider'],
    'demo-gpu-culling': ['amp-slider','speed-slider'],
    'demo-gpu-lod': ['speed-slider'],
    'demo-mega-buffer': ['speed-slider'],

    // --- 3D Model Examples ---
    'demo-glb-loader': ['amp-slider','speed-slider'],
    'demo-epic-swarm': ['amp-slider','speed-slider'],

    // --- 3D PBR Materials Examples ---
    'demo-pbr-test': ['speed-slider'],
    'demo-mixamo-model': ['speed-slider'],
    'demo-aetherial-monkey-flow': [],

    // --- 3D Animation Examples ---
    'demo-simple-butterfly': ['speed-slider'],

    // Exception: Animation + Post Processing gets RGB sliders too
    'demo-animation-postprocessing': ['r-slider', 'g-slider', 'b-slider','speed-slider'],

    // WebGPU Experiments
    'demo-morphogenesis-diffusion': [
        'pattern-preset', // <--- Added here
        'feed-slider', 'kill-slider',
        'base-color', 'peak-color',
        'btn-restart','speed-slider',
    ],
    'demo-deferred-rendering':['speed-slider','amp-slider'],
    'demo-gyroid-resonance':['speed-slider','core-color','excite-color','fracture-color','btn-restart'],
    'demo-aetherial-flow':['speed-slider','curve-color','fast-color','pulse-color','btn-restart'],
    'demo-singularity':['speed-slider','core-singularity-color','hot-color','cool-color','btn-restart']
};export const ALL_MANAGED_SLIDERS = [
    'amp-slider', 'r-slider', 'g-slider', 'b-slider',
    'feed-slider', 'kill-slider', 'base-color', 'peak-color',
    'btn-restart', 'pattern-preset','speed-slider','core-color','excite-color','fracture-color',
    'curve-color','fast-color','pulse-color','core-singularity-color','hot-color','cool-color'
];