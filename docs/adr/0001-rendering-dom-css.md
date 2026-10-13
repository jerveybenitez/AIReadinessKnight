# ADR 0001 — Rendering approach: DOM + CSS on a fixed 1280×720 stage

Status: accepted (2026-10-13)

## Options

1. **Canvas 2D** — draw everything into a `<canvas>`; game-loop style rendering.
2. **DOM + CSS on a fixed logical stage** — absolutely-positioned `<img>`/element layers inside a
   1280×720 box; the whole box is scaled to fit the viewport with one `transform: scale()`.
3. **WebGL engine** (Phaser/PixiJS) — heavyweight framework.

## Choice

Option 2. One React scene renders a fixed 1280×720 stage; a small hook computes
`scale = min(vw / 1280, vh / 720)` from a `ResizeObserver` and applies it with `transform-origin:
top left`. Portrait viewports get a "rotate to play" overlay instead of a second layout.

## Why

- **Accessibility is a hard requirement**, not polish: every target must be a real focusable
  control with an accessible name, and the speech bubble cannot be the only way to read an option.
  DOM buttons give this for free; canvas would require a parallel ARIA/DOM mirror for every target,
  which is double bookkeeping and the classic place a11y silently breaks.
- **Every image is a CMS upload** resolved through one fallback chain. `<img src={resolvedUrl}>` is
  the whole integration; canvas would add an image-loading/spritesheet pipeline that solves nothing
  here (`sharp` + media URLs already do it).
- **Animation complexity is low**: sprite-frame swaps, one projectile travel, a recoil. CSS
  transitions/keyframes + timed frame swaps cover it. Canvas buys performance we do not need at
  5 targets and 1 knight.
- **Placeholder art** (M3–M7) must be code-generated labelled rectangles. Trivial with DOM divs;
  canvas means writing a mini text/rect renderer.
- Landscape-only means exactly one aspect ratio to compose for — scaling one fixed stage is the
  simplest thing that works on desktop and tablet.

## What it costs

- No sub-pixel sprite batching; irrelevant at this volume.
- A hit-test quirk: the stage is scaled, so pointer coordinates are fine (browser handles it), but
  programmatic position math (projectile landing) must use stage coordinates, not screen pixels.
  Rule: all animation math happens inside the 1280×720 coordinate space.
- If a future mode wants particle-heavy effects, DOM gets awkward — acceptable; revisit per mode.

## Related

- ADR 0002 (run persistence), `knight-game` skill (question-screen contract, animation rules).
