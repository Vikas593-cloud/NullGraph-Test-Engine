# NullGraph Test Engine

<div align="center">

![NullGraph](https://img.shields.io/badge/NullGraph-v1.0.0-33e6cc?style=for-the-badge)
![WebGPU](https://img.shields.io/badge/WebGPU-API-ff6b6b?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-51cf66?style=for-the-badge)

**Zero scene graph. Zero copy. Infinite scale.**

</div>

---

## Overview

**NullGraph Test Engine** is a comprehensive, interactive testing ground and documentation hub for the NullGraph rendering ecosystem. Far more than a simple boilerplate, it provides a fully-featured **WebGPU laboratory** where developers can:

- Explore **20+ interactive WebGPU shader experiments** (from Reaction-Diffusion to Quantum Nebula)
- Benchmark **Data-Oriented Design patterns** (AoS, SoA, AoSoA) against traditional OOP scene graphs
- Test **3D rendering pipelines** including GPU culling, PBR materials, skeletal animations, and post-processing
- Browse the **complete NullGraph API reference** with live documentation
- Experiment with **engine controls** in real-time using the integrated control panel

The engine renders a massive grid of instanced entities by mapping raw `Float32Array` data directly to WebGPU storage buffers—bypassing traditional scene graphs entirely.

---

## Live Demo Architecture

The test engine (`index.html`) is structured into three main panels:

### Left Sidebar — Navigation & Demos
- **NullGraph v1.0.0 Documentation** — Complete API reference covering Core Engine, Geometry, Materials, Loaders, and Profiling tools
- **WebGPU Experiments** — 15+ compute shader and fragment shader artistic demos
- **Architecture Demos** — AoS, SoA, AoSoA, and OOP benchmark visualizations
- **3D Geometry Examples** — Cube rendering, GPU culling, LOD, and mega-buffer techniques
- **3D Model & Animation** — GLB loading, PBR materials, skeletal animation, and post-processing
- **Game Examples** — Space Fleet (compute-culled) and Fireworks (DOD physics)

### Center Canvas — WebGPU Rendering Surface
- Full-screen WebGPU canvas (`#gpuCanvas`) rendering thousands of instanced entities
- Interactive camera controls for scene navigation
- Loading screen with initialization spinner

### Right Control Panel — Real-Time Tuning
- **Engine Controls** — Simulation speed, wave amplitude, aura RGB channels
- **Reaction-Diffusion Parameters** — Feed rate, kill rate, base/peak colors
- **Pattern Presets** — Coral Maze, Mitosis, Boiling Chaos, Pulsating Spots, etc.
- **Demo Documentation** — Dynamic information panel showing concepts and details for each selected demo

---

## Key Characteristics

- ✅ **No `new Mesh()` allocations** — Raw Float32Array buffers only
- ✅ **No scene graph traversal** — No `.traverse()` or `.updateMatrixWorld()`
- ✅ **No garbage collection spikes** — Pre-allocated memory pools
- ✅ **100% WebGPU rendering pipeline** — No WebGL fallback
- ✅ **100% Data-Oriented Design (DOD)** — Cache-friendly contiguous memory layouts
- ✅ **Built-in Monaco Editor** — View and edit shader code live
- ✅ **MathJax support** — Renders mathematical notation in documentation

---

## Quick Start

### Prerequisites

- **Node.js** v16 or higher
- **WebGPU-compatible browser:**
  - Chrome 113+
  - Edge 113+
  - Safari (WebGPU feature flags enabled)
  - Firefox Nightly (`dom.webgpu.enabled` flag)

### Installation

```bash
# Clone the repository
git clone https://github.com/Vikas593-cloud/NullGraph-Test-Engine.git
cd test-engine

# Install dependencies (including null-graph and build tools)
npm install

# Start the development server
npm run dev
```

# Test Engine

Open your browser and navigate to:

```text
http://127.0.0.1:8000
```
---

## 📦 Asset Setup (Required)

Some 3D models used in the demos are **not included** in this repository due to licensing restrictions.

### Missing Assets

| Asset | Source | License | Included? | Reason |
|-------|--------|---------|-----------|--------|
| Mixamo Characters/Animations | [mixamo.com](https://www.mixamo.com) | Adobe Royalty-Free | ❌ | License restriction |
| Kenney Game Assets | [kenney.nl](https://kenney.nl) | CC0 | ❌ | File size |
| PBR Textures | [polyhaven.com](https://polyhaven.com/textures) | CC0 | ❌ | File size (100MB+) |
| Stanford Monkey | Public Domain | CC0 | ✅ Included | — |
### How to Get Missing Assets

1. **Mixamo Models** — Download characters and animations from [Mixamo](https://www.mixamo.com) (free Adobe account required)
  - Place `.glb` files in: `public/assets/models/mixamo/`
  - Download "X Bot", "Y Bot", or any character + animation you prefer

2. **Kenney Assets** — Download from [kenney.nl/assets](https://kenney.nl/assets)
  - Place files in: `public/assets/models/kenney/`

### Expected Folder Structure
---

## Running the Project

Start the development server:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:8000
```

(or the port specified in your terminal output)

---

# How It Works

The core rendering pipeline relies on direct memory mapping:

- No intermediate objects
- No pointer chasing
- No unnecessary garbage collection pressure

## Rendering Pipeline

```ts
// 1. Allocate a flat array in memory (14 floats per entity)
const ecsBuffer = new Float32Array(10000 * 14);

// 2. Populate entity data (typically handled in a Web Worker)
ecsBuffer[1] = x;   // Position X
ecsBuffer[2] = y;   // Position Y
ecsBuffer[3] = z;   // Position Z

// 3. Upload the raw buffer directly to the GPU
engine.updateEntities(ecsBuffer, 10000);

// 4. GPU reads buffers directly — no CPU-side tree traversal
```

This approach eliminates intermediate abstractions and allows the GPU to consume structured data directly from contiguous memory.

---

# Available Demos

## WebGPU Experiments (Compute & Fragment Shaders)

| Demo | Description |
|---|---|
| Morphogenesis (Alan Turing, 1952) | Reaction-Diffusion pattern generation |
| Quantum Core | Quantum-inspired particle simulation |
| Singularity | Gravitational lensing effect |
| Aetherial Flow | Fluid dynamics simulation |
| Deferred Rendering | G-Buffer and lighting pass demo |
| Cymatic Resonance | Sound wave visualization |
| Quantum Nebula | Volumetric nebula rendering |
| Gyroid Resonance | Triply periodic minimal surface |
| Stellarator Flux | Magnetic confinement visualization |
| Hopf Fibration | 4D topology projected to 3D |
| Aizawa Canvas | Chaotic attractor visualization |
| Iridescent Leviathan | Iridescent surface shading |

---

## Architecture Demos (Memory Layout Benchmarks)

| Demo | Description |
|---|---|
| AoS (Array of Structs) | Standard DOD baseline |
| SoA (Struct of Arrays) | Cache-friendly contiguous memory |
| AoSoA (Chunked SoA) | AAA industry standard for SIMD vectorization |
| OOP (Scene Graph) | Traditional pointer-chasing stress test |

---

## 3D Rendering Demos

| Demo | Description |
|---|---|
| 3D Geometry (Cube) | Basic instanced rendering |
| 3D Geometry + Light | Dot-product normal lighting |
| GPU Culling (Indirect) | Compute shader frustum culling |
| GPU Level of Detail | Dynamic LOD selection |
| GPU Mega Buffer | Massive buffer streaming |

---

## Advanced 3D Features

| Demo | Description |
|---|---|
| PBR Test | Rusty metal monkey with Cook-Torrance BRDF |
| Mixamo Model | Animated character with PBR materials |
| Simple Butterfly | GPU skeletal animation |
| Animation + Post-Processing | Skinned mesh with CRT effect |
| Space Fleet | Compute-culled fleet with HUD post-processing |
| Fireworks Simulation | 15,000+ DOD physics particles |

---

# Tech Stack

| Technology | Details |
|---|---|
| Language | TypeScript 5.0+ |
| Graphics API | WebGPU (no WebGL fallback) |
| Math Library | gl-matrix (high-performance vector/matrix operations) |
| Bundler | esbuild (fast, zero-config bundling) |
| Code Editor | Monaco Editor (VS Code engine) |
| Math Rendering | MathJax 3 (LaTeX support) |
| Font | Inter (modern sans-serif) |

---

# Browser Compatibility

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome | 113+ | Full WebGPU support |
| Edge | 113+ | Chromium-based, full support |
| Safari | Technology Preview | Requires WebGPU flag |
| Firefox | Nightly | Enable `dom.webgpu.enabled` |

---

# Development Notes

- Built around Data-Oriented Design (DOD) principles
- GPU-first rendering architecture
- Optimized for large-scale entity processing
- Minimal CPU-side abstraction overhead
- Designed for experimentation with compute shaders and advanced rendering techniques
bash

# License

This project is released under the MIT License.

---

# Related Projects

## NullGraph Core Engine

The standalone rendering library powering the engine architecture.

- GitHub: https://github.com/Vikas593-cloud/NullGraph
- npm: Search for `null-graph`

---

## Axion Engine

A full game engine being built on top of NullGraph.

- Live Preview: https://axion-engine.web.app/

---

<div align="center">

Built with **NullGraph** — Zero scene graph. Zero copy. Infinite scale.

</div>