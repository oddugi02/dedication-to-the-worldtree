# Home Parallax and Ornament Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained home-screen pointer parallax and replace the ornamental viewer's glossy photographs with the supplied interactive GLB ornaments.

**Architecture:** A small DOM-only motion module will expose smoothed pointer values for the home screen, leaving all 3D journey code untouched. A dedicated Three.js ornament viewer will load optimized copies of six GLBs, clone them according to existing placement data, and own its drag/zoom lifecycle.

**Tech Stack:** Native ES modules, Three.js, GLTFLoader, Node test runner, CSS transforms.

**Spec:** `docs/superpowers/specs/2026-11-23-home-parallax-and-ornament-viewer-design.md`

## Global Constraints

- Preserve the six existing placement coordinates, stage repetition, and growth calculations.
- Use supplied GLBs only after reducing embedded texture dimensions to at most 2048px; preserve meshes and materials.
- Do not apply pointer-driven distortion to touch, reduced-motion, or small-screen layouts.
- Do not use decorative placeholder text or emoji in product UI.

## Review Focus

- Reduced-motion and touch devices: no continuous pointer animation or inaccessible interaction.
- GLB load failure: the existing 2D ornament remains available as a readable fallback.
- Re-entering or leaving the ornament view: canvas, listeners, and GPU resources are released.
- Dense 3.0 growth values: all repetitions render without clipping or altered placement.
- Pointer leaves the home section: transforms return smoothly to neutral rather than remaining offset.

---

### Task 1: Home motion controller

**Files:**
- Create: `src/home-motion.js`
- Test: `tests/home-motion.test.js`
- Modify: `src/app.js`, `src/style.css`

**Interfaces:**
- Produces: `createHomeMotion(element: HTMLElement): { dispose(): void }`
- Consumes: CSS variables `--parallax-x`, `--parallax-y`, `--parallax-tilt-x`, `--parallax-tilt-y`.

- [ ] Write a failing test for target clamping and neutral return.
- [ ] Run `node --test tests/home-motion.test.js` and confirm the absent module fails.
- [ ] Implement the pure coordinate mapper and the DOM controller using one animation frame loop.
- [ ] Apply the four CSS variables only to the home background, glow, title, and copy layers; disable at reduced-motion/touch/small breakpoints.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Optimized ornament assets and interactive renderer

**Files:**
- Create: `src/ornament-viewer.js`, `tests/ornament-viewer.test.js`
- Create: `public/assets/ornaments/{embrace,offer,endure,accept,reach,accumulate}.glb`
- Modify: `src/app.js`, `src/style.css`, `tests/ornament.test.js`

**Interfaces:**
- Produces: `createOrnamentViewer(host: HTMLElement, person: Person): Promise<{ dispose(): void }>`.
- Consumes: `placements`, `person.growth`, and the six optimized GLB filenames.

- [ ] Write a failing test that maps the six Korean actions to their stable asset filenames and returns existing stage poses.
- [ ] Run `node --test tests/ornament-viewer.test.js` and confirm the missing module fails.
- [ ] Create optimized asset copies with the repository's GLB texture resizer and record output sizes.
- [ ] Implement one renderer, camera, lights, cached GLTF loads, cloning, existing 2D coordinates mapped to the scene, drag rotation, wheel zoom, and disposal.
- [ ] Replace the interactive ornament page's SVG only; preserve the 2D SVG for altar texture creation and as a load fallback.
- [ ] Run `npm test` and confirm all tests pass.

### Task 3: Browser and deployment verification

**Files:**
- Modify: `index.html`, `_headers`, `outputs/netlify-deploy/**`, deployment zip.

- [x] Bump module/style asset versions to prevent stale browser assets.
- [x] Verify home hover movement, reset, responsive/reduced-motion behavior, drag rotation, zoom, and console output in the local site.
- [x] Sync source assets and code into the Netlify deploy directory.
- [x] Create and test a new Netlify zip package.
