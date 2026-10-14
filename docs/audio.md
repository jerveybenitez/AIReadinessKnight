# Audio — the shared sound set (M13, QODER.md §3.7)

The audio counterpart to `docs/art-prompts.md`. Unlike art, **one static set plays in every mode**
(`default`, `electric`, `default16`, and any future mode): a re-skin changes how the game looks,
never how it sounds. This document records where every cue came from, the format decision, and how
to regenerate or extend the set.

## The source decision

**Every cue is synthesised by a checked-in script — `scripts/audio/generate-set.mjs`.** No
audio-generation service exists in this environment, and the alternative (sourcing CC0 files)
would have put per-file provenance and license tracking on the permanent maintenance bill. The
synthesised set is:

- **License-clean by construction** — no external work, no attribution duty, no license audit.
- **Deterministic** — every noise source is drawn from a seeded PRNG (mulberry32) and every note
  is hard-coded; re-running the script reproduces the files byte-identically (verified in M13 by
  regenerating and comparing sizes/hashes).
- **Regenerable for a different mood** — change the note tables or the synthesis parameters and
  re-run; the sanity checks gate the output.
- **Stylistically right** — a chiptune/synth palette suits the game and suits `default16`
  *exactly*.

There are no per-cue external sources to record: the "source" of every file below is the
composition/synthesis recipe in `scripts/audio/generate-set.mjs`, cited per cue.

## Format and size

**WAV, 22050 Hz, mono, 16-bit PCM.** The full format/delivery rationale (including the encoder
survey that ruled out mp3/ogg on this machine) is ADR 0005. Short version: no encoder for a
compressed format exists here, and uncompressed loops are only acceptable at reduced width/rate —
mono/22050 keeps each music file in the ~500–900 KB range while every one-shot stays under ~75 KB.
44.1 kHz stereo would have put a 15–20 s loop over 5 MB, which §3.7's no-blocking rule rejects in
spirit.

All files live in `public/audio/` and are fetched lazily — nothing audio-related is on the first
paint's critical path.

## The set (15 files, 2521 KB total)

### Music beds (looping)

| File | Length | Recipe |
| --- | --- | --- |
| `music-title.wav` | 19.20 s | `composeTitle()` — A minor, 100 BPM, 8 bars (i–VI–III–VII ×2). Stately lute-and-flute chiptune: triangle flute lead over a square bass half-note pulse and a quiet sine sparkle an octave up. Bar 8 walks G→A so the loop seam resolves home. |
| `music-gameplay.wav` | 14.55 s | `composeGameplay()` — E minor, 132 BPM, 8 bars (Em C G D ×2). Driving training-ground loop: kick 4-on-the-floor, snare 2 & 4, hats on 8ths (open hat on the last), square eighth-note bass, square arpeggio lead. **One loop for all three sections** (§3.7). Bar 8 walks D→E into the restart. |
| `music-results.wav` | 17.14 s | `composeResults()` — C major, 112 BPM, 8 bars (C G Am F ×2). Triumphant but loopable reckoning theme: square lead with a quiet triangle octave double, half-note triangle bass, kick on 1 & 3, hats on 8ths. Bar 8 walks F→G into the restart. |

Every loop is composed to a whole number of bars with every voice periodic over those bars, so the
seam sits on a pattern boundary with no tail crossing it — verified by construction and by the
loop behaviour in the engine.

### Section feedback (the only section-aware cues)

| File | Length | Recipe |
| --- | --- | --- |
| `attack-archery.wav` | 0.35 s | `synthAttackArchery()` — bow release: band-swept noise "thwip" (1.8→6.5 kHz) + fast low sine twang (190→95 Hz) + short string ping. |
| `attack-boxing.wav` | 0.25 s | `synthAttackBoxing()` — punch: low sine drop (165→55 Hz) + damped low-pass noise click. |
| `attack-swordsmanship.wav` | 0.32 s | `synthAttackSword()` — sword swish: rising band noise (0.9→4.8 kHz) + short metallic square ring. |
| `attack-generic.wav` | 0.22 s | `synthAttackGeneric()` — generic whoosh-thud; the **fallback** when a section attack cue is missing (never fetched in the shipped set). |
| `impact.wav` | 0.30 s | `synthImpact()` — hit: low-pass noise burst + low body thump (130→48 Hz) + short sine ring. Played at the moment the projectile lands (`FLIGHT_MS`, the arrow's beat — ADR 0003). |

### Scene stings (one-shots)

| File | Length | Recipe |
| --- | --- | --- |
| `sting-low.wav` | 1.70 s | `synthStingLow()` — section-end band `0-0.9`: descending minor line (A→F), deflated. |
| `sting-mid.wav` | 1.30 s | `synthStingMid()` — band `1-2.9`: two level notes, neither celebration nor disaster. |
| `sting-high.wav` | 1.20 s | `stingStingHigh()` — band `3-4`: rising major arpeggio into a bright chord stab. |
| `results-reveal.wav` | 1.50 s | `synthResultsReveal()` — quick ascending run into a held triumphant chord with a bass root and noise shimmer. |

### UI

| File | Length | Recipe |
| --- | --- | --- |
| `ui-hover.wav` | 0.06 s | `synthUiHover()` — short rising sine blip (920→1180 Hz) on target hover/focus; 70 ms throttle in the engine. |
| `ui-select.wav` | 0.14 s | `synthUiSelect()` — two-note square confirm (E5→A5). |
| `ui-error.wav` | 0.28 s | `synthUiError()` — dull detuned double-square buzz (110 + 116.5 Hz). |

## Runtime contract

- **One resolver.** `src/game/audio/sounds.ts` exports `soundFor(cue, { section? })`, mirroring
  `assetFor`. Components never reference a file path; promoting audio into the CMS one day is a
  change to this resolver and nothing else. Per-section cues (`attack`) fall back to the generic
  file when a section variant is missing; an unknown cue resolves to `null` (silence).
- **One engine.** `src/game/audio/engine.ts` (singleton `audioEngine`). Music beds play through a
  looping `HTMLAudioElement`; one-shots are fetched + decoded once (`AudioBufferSourceNode`
  through a master gain). Key rules, all from §3.7:
  - **Gesture-gated.** Nothing plays before the first real interaction (`unlock()` from the
    Begin button, the mute control, or Stage's one-time global gesture listener). Earlier calls
    hold the desired music until the unlock arrives.
  - **Mute is mandatory and persisted** (`ark:muted` in localStorage, across reloads and runs).
    Under browser automation (`navigator.webdriver`) the engine starts **muted**, which is what
    makes the e2e suite silent by default. `prefers-reduced-motion` is not a mute signal.
  - **Degrade to silence.** Missing file, failed fetch, decode error, no output device — each
    resolves to quiet; failures are cached so a broken cue is retried at most once per session.
    The scene machine never waits on audio: the 700 ms attack choreography (ADR 0003) owns the
    advance exactly as before, and no cue in the set is longer than its beat.
- **The visible control.** `src/game/components/MuteControl.tsx` renders on every scene via
  `Stage`: a real button, keyboard-reachable, `aria-pressed` + a proper accessible name
  ("Mute sound" / "Unmute sound"), synced to the engine through `useSyncExternalStore`.

## Regenerating or extending the set

```bash
pnpm audio:generate
```

The script overwrites `public/audio/*.wav` and prints a per-file table (duration, KB, sanity
check). The sanity checks fail the run (exit 1) if any file is near-silent before normalisation,
peaks wrongly after it, or lands outside its expected duration — so a bad edit to the recipes
cannot ship quietly. To add a cue: write a `synthX()` function, add a `[file, fn, seconds]` row to
`SET`, and wire the cue name into `SoundCue`/`SOUNDS` in `src/game/audio/sounds.ts` plus the
scene(s) that play it.

## Testing notes

`tests/e2e/audio.e2e.spec.ts` (5 specs) covers the §3.7 contract:

- Mute toggle is keyboard-reachable and its state persists across reloads (both directions).
- A deliberately corrupted `attack-archery.wav` degrades to silence — the question still advances
  and the console stays clean.
- A failed report generation plays `ui-error` and the results screen stays intact.
- The **same set** loads in `default`, `electric` and `default16` (identical URL sets, zero
  console errors). Each mode runs in a **fresh browser context** because Chrome serves repeat
  media-element loads from a per-context cache with no network traffic — watching one page across
  navigations would miss the music beds on the later modes.
- A full `/default` playthrough fires every cue at its moment (13 expected cues; `attack-generic`
  and `ui-error` provably *not* requested in a clean run) with zero console errors.

What the suite cannot assert in headless CI is *taste* — levels, mix balance, loop feel. Those
were reviewed by playing the game in a real browser during M13 (see PROGRESS.md); regenerate and
re-listen whenever the recipes change.
