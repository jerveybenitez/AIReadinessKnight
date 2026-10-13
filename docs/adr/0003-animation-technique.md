# ADR 0003 — Attack choreography: sprite swaps + CSS keyframes, never game state

Status: accepted (2026-10-13)

## Options

1. **Canvas/sprite-sheet engine** — a requestAnimationFrame loop drawing frames.
2. **DOM + CSS** — pose swaps via CMS sprites, choreography via CSS keyframes driven by custom
   properties, completion signalled to the machine by a single timer that always resolves.
3. **Lottie / video clips** — one pre-rendered animation file per action as the CMS asset.

## Choice

Option 2.

## Why

- ADR 0001 already renders the game as DOM on a fixed 1280×720 stage. Option 2 keeps one rendering
  model, and the CMS asset contract stays "one URL per pose slot" — the same shape as every other
  slot, so a backend user re-skins animations by uploading images like everything else.
- **The machine must never wait on an animation** (knight-game skill failure mode #3). The answer
  is stored server-side *before* playback starts, and the scene owns one `finish()` contract:
  a timer at `FLIGHT_MS + IMPACT_HOLD_MS` (700ms, inside the 600–1200ms budget), an any-key
  listener, and a full-board skip layer — all three resolve into the same `onActionComplete()`,
  guarded by a ref so it fires exactly once. Reduced motion calls `finish()` synchronously.
  Every path reaches the same next state; no path can strand the player mid-attack.
- **Timings cannot drift**: the flight duration and the target's impact-frame delay are the same
  value, shared between JS and CSS through the `--ark-impact-delay` custom property set on the
  scene root. The arrow lands and the target changes pose on the same beat by construction.
- Section-end animations (M5) and the result pose (M6) reuse the exact same shape: pose swap +
  CSS animation + skip path, so there is one animation technique to maintain.

## What it costs

- Multi-part sequences are hand-choreographed in CSS (archery is the reference; boxing and
  swordsmanship vary the sprite slots and keyframes, not the technique).
- `var()` inside `@keyframes` requires a modern browser — fine, the stage already requires modern
  CSS (`color-mix`), and the product targets desktop/tablet landscape.
- Motion is per-pose discrete sprite swaps rather than tweened rigs — which is exactly the
  Pokémon-era art direction the brief asks for.

## Rejected

- Canvas engine: a second rendering world next to the DOM game; it would move layout and hit
  targets out of the accessibility tree and add a loop to debug for three short actions.
- Lottie/video: heavier assets, playback harder to make skippable and keyboard-integrated, and the
  CMS asset contract would grow a second type for no visible gain at this art scale.
