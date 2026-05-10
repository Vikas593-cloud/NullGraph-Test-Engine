import {demoRegistry} from "./data/demoRegistryData";

export interface UIState {
    timeScale: number;
    amplitude: number;
    auraR: number;
    auraG: number;
    auraB: number;

    // Morphogenesis Parameters
    feedRate: number;
    killRate: number;
    baseColor: number[]; // [r, g, b]
    peakColor: number[]; // [r, g, b]

    // --- NEW: Gyroid Resonance Parameters ---
    coreColor: number[];     // [r, g, b]
    exciteColor: number[];   // [r, g, b]
    fractureColor: number[]; // [r, g, b]

    // --- Aetherial Flow Params
    curveColor: number[];     // [r, g, b]
    fastColor: number[];   // [r, g, b]
    pulseColor: number[]; // [r, g, b]

    //--- Singularity ---
    coolColor :number[],
    hotColor:number[],
    coreSingularityColor:number[],

    wantsRestart: boolean;
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

export type DemoId = keyof typeof demoRegistry;

import { NullGraph, Camera } from 'null-graph';

// What a standard demo setup function returns
export interface DemoInstance {
    update: (simTime: number) => void;
    destroy: () => void;
    cameraUpdate?: (cam: Camera, time: number, ctrl: any) => void;
}

// The context passed into custom demos
export interface CustomDemoContext {
    activeUpdateLoop: ((simTime: number) => void) | null;
    activeDestroyFunc: (() => void) | null;
}

// A discriminated union so TypeScript knows an entry has EITHER 'setup' OR 'custom'
export type DemoRegistryEntry =
    | {
    setup: (engine: NullGraph, camera: Camera, getState: () => UIState) => Promise<DemoInstance> | DemoInstance;
    camera?: boolean;
    custom?: never; // Explicitly tells TS this won't exist here
}
    | {
    custom: (engine: NullGraph, camera: Camera, getState: () => UIState, ctx: CustomDemoContext) => Promise<void> | void;
    setup?: never;  // Explicitly tells TS this won't exist here
    camera?: never;
};

