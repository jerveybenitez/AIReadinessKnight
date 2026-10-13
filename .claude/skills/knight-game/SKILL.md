---
name: knight-game
description: Use when building or changing the AI-Ready Knight HTML5 game frontend — scene flow, the question screen, hover/click interactions, attack and section animations, run state persistence, replay/back navigation, scoring display, keyboard play and reduced-motion. Use when debugging a stuck scene, an animation that doesn't fire, a lost run, or a question that won't replay.
---

# AI-Ready Knight — Game Frontend

The game is a 3-section, 15-question knight training sim rendered from CMS data. One screen
component serves all three sections; only the props differ.

## Architecture

```
src/game/
├── scoring.ts          pure, tested: answer[] -> section bands + final band
├── machine.ts          scene state machine, the single source of "where am I"
├── run.ts              run state: create, hydrate, persist, resume
├── scenes/
│   ├── Title.tsx
│   ├── Intake.tsx
│   ├── Question.tsx    THE screen — all 3 sections
│   ├── SectionEnd.tsx
│   └── Results.tsx
└── components/
    ├── Target.tsx      archery target | punching bag | training dummy
    ├── SpeechBubble.tsx
    ├── Knight.tsx      idle + attack + celebrate poses
    └── ProgressNav.tsx
```

Keep `scoring.ts` and `machine.ts` free of React, DOM and Payload imports. They are the two pieces
most likely to be wrong, and they are only cheap to test if they are pure.

## Scene machine

```
title → intake → question(s1,q1..q5) → sectionEnd(s1)
                → question(s2,q1..q5) → sectionEnd(s2)
                → question(s3,q1..q5) → sectionEnd(s3)
                → results
```

Rules:

- The machine owns the current scene. No component may render a scene by local state.
- Transitions are explicit named events (`ANSWER`, `BACK`, `NEXT`, `SECTION_DONE`), never
  `setScene(x)` from arbitrary code.
- `BACK` is legal from any question to any **already-answered** question, across section
  boundaries. It is not legal into an unanswered future question.
- Re-answering **replaces** the stored answer for that question id. Never append. A run has at most
  one answer per question id — enforce it in the type (`Record<questionId, Answer>`, not an array).
- Entering `results` requires all 15 answers. Assert it; a partial results screen is a bug.

## The question screen contract

One component, three skins. Derived from `game_concept/Screens/`.

```tsx
<QuestionScene
  question={{ id, text, options: [5 options ordered score 0→4] }}
  skin={mode.sections[i].skin}   // targets, weapon, knight sprites, background, hit effect
  position={{ section: 1..3, question: 1..5 }}
  answered={Answer | undefined}
  onAnswer={(optionIndex) => ...}
  onBack={() => ...}
/>
```

Three states, all three required:

| State | Must do |
| --- | --- |
| **base** | Question text top-centre. 5 targets in a row, left→right = score 0→4. Knight idle, holding the section weapon. Progress indicator visible. |
| **hover / focus** | Speech bubble shows that option's **full text**, tail anchored to that target. Target visually highlights. Pointer hover and keyboard focus must produce the *same* state — wire both to one handler. |
| **click / Enter** | Knight attack animation → projectile/strike travels → impact on the chosen target → short beat → advance. |

Non-negotiables on this screen:

- Each target is a real focusable control (`<button>`), with `aria-label` = the option text.
  Do not build it from `<div onClick>`.
- The speech bubble is a convenience, not the only way to read an option. Screen readers get the
  text from the button.
- Arrow keys move between targets, Enter/Space selects, Tab reaches prev/next.
- An already-answered question renders its chosen target in a selected state when revisited.

## Animation

Pick one technique and stay with it (record it in an ADR). Whatever you pick:

- **Animations never own game state.** Fire the state transition on answer; the animation is a
  visual consequence that can be skipped at any time. If an animation can strand the player, the
  design is wrong.
- Every animation has a **skip path**: `prefers-reduced-motion`, a click during playback, or a
  timeout all land in the same final state.
- Keep attack animations short — roughly 600–1200ms. 15 of them in a row gets tedious fast.
- Section-end animations come from the band (see scoring) and use the `section_animation` text in
  the CMS as the creative spec plus a CMS asset slot.

```ts
// the shape every animation hook should satisfy
function playAttack(target: number, opts: { reducedMotion: boolean }): Promise<void>
// resolves when the visual is done OR immediately when reducedMotion — callers never branch
```

## Scoring

```ts
// src/game/scoring.ts — pure, unit-tested, the only place band rules live
type Band = 'low_average' | 'average' | 'high_average'

sectionMean(answers)  // mean of that section's 5 scores, 0..4
finalMean(answers)    // mean of all 15 scores, 0..4
bandFor(mean): Band   // [2.9,4.0] high · [1.7,2.8] average · [0,1.6] low
```

The ranges in `ai_readiness_questions.json` are written high-first and leave gaps between bands
(2.8 → 2.9, 1.6 → 1.7). Handle the gaps explicitly with `>=` thresholds; do not let a mean of 2.85
fall through to `undefined`. Test the boundaries: `0, 1.6, 1.65, 1.7, 2.8, 2.85, 2.9, 4`.

Section-end animation keys (`"0"`, `"1-2"`, `"3-4"`) map onto the same three bands.

## Run persistence

The player can refresh mid-run and must not lose progress.

- Create a run with an **unguessable id** (uuid/nanoid) at intake, persist it server-side.
- Mirror the run id in `sessionStorage` so a refresh re-attaches to the same run.
- Write the answer server-side on each answer, not only at the end — a closed tab mid-run should
  still leave a resumable run.
- Never put the full answer set in a URL or `localStorage` in a form another site could read.
- Results permalinks use the run id, which is why the id must be unguessable: these runs carry
  company names.

## Common failure modes

1. **Hover state wired only to `onMouseEnter`** — keyboard users get no speech bubble. Wire
   `onFocus` to the same handler.
2. **Answer appended instead of replaced** on replay — scores silently inflate. Key answers by
   question id.
3. **Animation promise never resolves** (a dropped `transitionend`, a tab backgrounded mid-tween)
   and the player is stuck forever. Always race the animation against a timeout.
4. **Section index derived from array position** in a mode whose sections were reordered in the
   CMS. Derive from the section's stable id.
5. **Scoring done in the component.** It ends up duplicated in the results screen and the report
   prompt, and the two drift. One module, imported everywhere.
6. **Assuming 5 options.** Validate the loaded mode and fail loudly in dev if a question has any
   other count — the whole layout assumes 5.
7. **Blocking the player on the QWEN call.** Show the score immediately; stream or poll the report.
