# AI-Ready Knight — Build Brief for Qoder Agent

> This is a **long-running, multi-session build task**. Read this entire file before writing code.
> `Qoder.txt` is the original human brief and remains the source of intent — if this file and
> `Qoder.txt` ever disagree, `Qoder.txt` wins and you should flag the conflict.

---

## 0. Mission

Turn an existing AI-readiness questionnaire into a **gamified web experience**: the player is a
knight-in-training who answers 15 questions across 3 training sections (archery, boxing,
swordsmanship). Each answer is an in-world action (loose an arrow, punch a bag, strike a dummy).
At the end, the knight's final appearance reflects the score, and a QWEN-generated report tells the
company what to do next.

A Payload CMS backend lets non-developers re-skin the entire game per client ("modes") without
touching code.

**Definition of done:** a stranger can open `http://localhost:3000/default`, play through all three
sections with mouse or keyboard, and receive a scored report — while an admin can log into
`/admin`, create a mode called `electric`, swap every asset and question, and have
`http://localhost:3000/electric` render that variant with zero code changes.

---

## 1. Ground truth — what already exists

Verify these yourself before planning; do not assume.

| Thing | State |
| --- | --- |
| `src/payload.config.ts` | Blank Payload 3.90.2 scaffold. Postgres adapter, Lexical editor, `Users` + `Media` collections only. |
| `src/collections/Users.ts`, `Media.ts` | Default scaffold collections. |
| `src/app/(frontend)/page.tsx` | Default placeholder page. Replace. |
| `src/app/(payload)/` | Payload admin + API routes. **Do not restructure.** |
| `ai_readiness_questions.json` | All 15 questions, 3 sections, animation descriptions, final-pose rules. The seed source of truth. |
| `game_concept/Screens/` | 9 **hand-drawn wireframes** (base / on-hover / on-click for each section). Layout intent only — not art assets. |
| `.env` | Contains `DATABASE_URL` and `PAYLOAD_SECRET` **only**. |
| `.claude/skills/` | `payload`, plus the game skills described in §9. |
| Stack | Next.js 16.3.3, React 19.2.6, Payload 3.90.2, Postgres, pnpm, TypeScript 5.7, Vitest + Playwright already configured. |

### Known gaps — resolve these early, do not silently work around them

1. **QWEN runs against a local endpoint for now.** No hosted credentials yet. Default
   `QWEN_BASE_URL` to a localhost OpenAI-compatible server, keep `QWEN_API_KEY` and `QWEN_MODEL`
   configurable, and add all three to `.env.example`. The app must degrade gracefully to a
   deterministic template report whenever the endpoint is unreachable — which, during local
   development, is most of the time. **Do not hardcode a hosted vendor URL.** See §5.
2. **No art assets exist yet.** `game_concept/` holds wireframes, not sprites. **You generate the
   default mode's sprites and animations yourself** (see §3.5). Until they exist, ship flat-colour
   labelled placeholders so no milestone is blocked on art.
   *Status (2026-10-13): resolved for `default` in M8 — the full set lives in `art/default/**` and
   is wired into the CMS. `electric` is still partial and is M11's job. Verify on disk; don't take
   this paragraph's present tense literally.*
3. **Scoring uses two different band sets** — section animations and the final pose do not share
   boundaries, and the final-pose ranges contain gaps. See §4; this is settled, follow it exactly.

---

## 2. Hard constraints

- **Exactly 3 sections, always.** The CMS must not allow a 4th or a 2nd. Enforce in collection
  config and validate on save.
- **Exactly 5 options per question**, ordered by score 0→4. The screens show 5 targets / 5 bags /
  5 dummies. A question with any other count is a data error.
- **No player login.** The game is public and anonymous. Only `/admin` is authenticated.
- **Postgres only**, via the existing `@payloadcms/db-postgres` adapter. Do not switch databases.
- **HTML5 web app.** Canvas or DOM+CSS — your call, justified in the ADR (§8). No Unity, no WebGL
  engine, no heavyweight game framework unless you justify it and the user approves.
- **Python is optional and currently unjustified.** Do not introduce it unless you hit a concrete
  wall and get approval first.
- **Do not delete or rewrite `Qoder.txt`, `ai_readiness_questions.json`, or `game_concept/`.**
- **Do not commit `.env`** or any secret. Check `.gitignore` covers it.

---

## 3. Game specification

### 3.1 Flow

```
/[mode]
  └── Title screen  ──►  Intake form  ──►  Section 1 (archery)   ──► section animation
                                      ──►  Section 2 (boxing)     ──► section animation
                                      ──►  Section 3 (sword)      ──► section animation
                                      ──►  Results + QWEN report
```

**Intake form** (before play, persisted to DB): knight name, company name, industry.
Treat these as personal data — see §6.

**Section screens**: each section is 5 questions shown one at a time.

**Replay rule:** the player can navigate back to *any* previously answered question at any time and
change their answer. Re-answering replaces the stored score; it does not add a second score. Make
the back/forward affordance visible on every question screen, and allow keyboard nav.

### 3.2 Question screen contract (derived from `game_concept/Screens/`)

All three sections share one layout; only the props differ. **Landscape only** — see §3.6.

```
┌──────────────────────────────────────────────────────────┐
│          [ speech bubble: hovered option text ]          │  ← appears on hover/focus,
│                        ▼ (tail points at target)         │     tail anchored to the target
│                                                          │
│   ◎     ◎     ◎     ◎     ◎                              │  ← 5 targets, score 0..4 left→right
│                                                          │
│        🧍 knight (idle / action animation)               │
│         └ bow | gloves | wooden sword                    │
│                                                          │
│   [ ← prev ]   Q3 of 5 · Section 1 of 3   [ next → ]     │
└──────────────────────────────────────────────────────────┘
```

| State | Behaviour |
| --- | --- |
| **Base** | Question text at top. 5 targets idle. Knight in idle pose holding the section weapon. |
| **On hover / focus** | Speech bubble shows that option's full text, tail pointing at the hovered target. Target highlights. |
| **On click / Enter** | Knight plays the attack animation; projectile/strike travels to the chosen target; impact feedback; brief pause; auto-advance to next question. |

Per-section target objects:

| Section | `game_training` | Targets | Weapon | Hit effect |
| --- | --- | --- | --- | --- |
| 1 — AI Use-Case & Business Readiness | `archery` | 5 archery targets | bow | arrow flies, sticks in target |
| 2 — AI Talent & Capability Readiness | `boxing` | 5 punching bags | gloves | bag swings on impact |
| 3 — AI Execution, Adoption & Sustainability | `swordsmanship` | 5 training dummies | wooden sword | slash effect, dummy recoils |

### 3.3 Section-end animation

After question 5 of a section, play the animation matching the section's score band, using the
`section_animation` strings in `ai_readiness_questions.json` as the creative spec. Every string is
CMS-editable text plus a CMS-managed animation asset slot.

### 3.4 Results screen

- Final knight appearance per `summary_pose.knight_end_animation` (gold/silver flashy · normal
  metal · still in training clothes).
- Overall score, plus a per-section breakdown.
- QWEN-generated summary and next steps (§5).
- **Shareable permalink.** The run gets an unguessable id and a permanent URL; the player can
  return to it, bookmark it and send it on. It is not single-use and must not expire.
  Because the link is shareable, it is also leakable — see §6 for what that constrains.

### 3.5 Art direction

2D anime-style sprite art, Pokémon-era flat pixel/sprite feel. The knight is a **girl**.
Background is a simple medieval training barracks — clean and readable, deliberately uncluttered.
Keep the background a single CMS-swappable image per section so re-skinning is trivial.

**You generate the `default` mode's art yourself** — sprites and animations for every slot listed in
the `game-assets` skill. Generate the whole set in one consistent pass; mixed-batch art reads as
wrong no matter how good each piece is. Keep the source prompts in `docs/art-prompts.md` so the set
can be regenerated or extended.

**Other modes supply their own art.** A backend user uploading an `electric` mode provides whatever
they want to override; **every slot they leave empty falls back to the `default` mode's asset.** A
mode with zero uploads is therefore still fully playable and looks exactly like `default`. This
fallback is a backend concern — see §7 and the `game-modes-cms` skill.

**Exception — `electric` is yours too.** M11 (§8) asks you to generate the *full* `electric` set
in-house, as an **electronic / cyberpunk re-skin of the `default` set**: same compositions, same
poses, same anchors, same framing — restyled. Neon on dark, circuitry and emissive accents, the
barracks training yard becoming a tech/industrial training bay; the knight stays the same girl in
the same silhouette, her leather training gear reading as techwear and her armour as powered plate.
Match `default` slot for slot so the two sets are swappable without any layout change. This is a
re-skin, not a redesign, and it changes nothing about the fallback mechanism above — it only means
`electric` ends up with nothing left to fall back for. **Questions, options and scores are
identical to `default` and must not be touched** (see M11).

**Exception — `default16` is yours too.** M12 (§8) asks for a third in-house set: a **16-bit,
SNES-era pixel-art re-skin of `default`**, on the slug `default16`. Same rules as `electric` —
same compositions, poses, anchors and framing, questions identical, `default` unaffected and still
the live default experience. Only the rendering style changes: chunky pixels, a deliberately
limited palette, hard-edged dithering instead of soft gradients, readable at a glance.

**Standing rule — things that stand on the ground must touch it.** Every section's targets
(archery targets, punching bags, training dummies) rest on the floor. Their feet, legs or base
must make contact with the background's ground plane — **no floating, no gap, in any mode.** This
is a contract between two separate images, so neither one can satisfy it alone:

- the **background** must put its ground plane (where the back wall, floor or horizon meets the
  standing surface) at the same stage Y in every section and every mode; and
- the **target sprite** must be drawn so its lowest contact point sits at the bottom of its alpha
  bounding box, with no transparent padding beneath it — the pipeline bottom-anchors sprites, so
  padding below the feet becomes visible float.

M12 owns measuring the single baseline Y this implies, writing it into the `game-assets` skill as
a named constant with the target-row geometry beside it, and stating it in every background and
target prompt from then on. **Check it before generating a full set, not after** — this is a
compositional constraint like the M8 bare-middle-band rule, and it is cheap before a pass and
expensive after.

### 3.6 Non-negotiable UX baseline

- **Landscape only, everywhere.** Logical stage of 1280×720, scaled to fit. Desktop and tablet are
  both landscape; the layout never reflows to portrait. A device held in portrait gets a clear
  "rotate to play" prompt, not a broken or stacked board. Do not build a second layout.
- Playable with keyboard alone (arrow keys / tab to move between targets, Enter to choose).
- Every target has an accessible name equal to its option text; the speech bubble is not the only
  way to read an option.
- Respects `prefers-reduced-motion`: animations collapse to instant state changes, game stays
  fully playable.
- Progress survives an accidental refresh mid-run.
- **Sound is optional, never required.** Nothing the player must know is conveyed by audio alone,
  and the game is fully playable muted or on a device with no audio output. See §3.7.

### 3.7 Audio

Added 2026-10-14; built in M13. Unlike art, **audio is one shared set across every mode** — the
same music and sound effects play in `default`, `electric`, `default16` and any future mode. It is
a static asset set in the repo, not a CMS upload, and it is deliberately generic: a mode re-skin
changes how the game looks, not how it sounds.

That is a conscious exception to "every asset is a CMS upload" (§7, `game-assets`), so build it to
be promotable later: every sound is read through **one resolver** (`soundFor('attack')`, mirroring
`assetFor`), so moving audio into the `modes` collection one day is a change to that resolver and
nothing else. No component ever references a file path directly.

**Format: ordinary web audio files, not MIDI.** Browsers have no built-in MIDI synth — playing a
`.mid` means shipping a JS synthesiser and a soundfont, which is a heavy dependency and
unpredictable output for no benefit. Use what `<audio>` / Web Audio plays natively. A chiptune
*style* is welcome; a MIDI *file format* is not.

The contract, all of it non-negotiable:

- **Nothing plays before a user gesture.** Browsers block autoplay, and an unlocked-too-early
  `AudioContext` throws console errors on every load. Unlock on the first real interaction (the
  title screen's Begin button) and treat anything earlier as muted.
- **A visible mute control on every scene**, keyboard reachable with a proper accessible name,
  state persisted across reloads and runs. Volume control is welcome; mute is mandatory.
- **Audio never blocks or breaks gameplay.** A missing file, a decode failure, a device with no
  output — each degrades to silence, and the scene advances exactly as it would have. Same
  philosophy as the QWEN fallback in §5: the feature is an enhancement, never a dependency.
- **No audio in the critical path of first paint.** Preload is lazy; the title screen must not
  wait on a music file.
- `prefers-reduced-motion` is not a mute signal and must not be treated as one — but anything that
  pulses or throbs in time with audio follows it like any other animation.

### 3.8 Loading and asset weight

Added 2026-10-14; built in M14. The player waits once, at the start, on a loading screen — never
mid-run, and never while watching a background paint in behind the targets.

- **Assets are delivered compressed.** Source art stays as authored in `art/`; what the browser
  receives is a web-delivery encode. A 1280×720 game does not ship multi-megabyte PNG backgrounds.
- **The first scene is preloaded behind a loading screen**; later sections are prefetched *during*
  play, so no scene transition ever waits on the network. The player is in section 1 for minutes —
  that is when sections 2 and 3 arrive.
- **Loading is bounded and escapable.** A slow or dead asset degrades to the game starting anyway,
  exactly like the QWEN (§5) and audio (§3.7) fallbacks. A loading screen that can trap a player
  forever is worse than no loading screen.
- **Progress is honest.** If a count is shown, it reflects real completed requests. Never a timed
  fake bar.
- The loading screen follows §3.6 like any other scene: landscape, keyboard-safe, reduced-motion
  respected, and it announces itself to assistive tech rather than being a silent blank stage.

---

## 4. Scoring — settled, implement exactly this

**Everything is a mean score per question on a 0–4 scale. Never a total.** A section's band comes
from the mean of its 5 answers; the final band comes from the mean of all 15.

There are **two different band sets**. They do not share boundaries. Do not unify them.

**Section bands** — drive the section-end animation (§3.3). Keys live in
`ai_readiness_questions.json` under `section_animation`:

| Band key | Mean range | Rule |
| --- | --- | --- |
| `3-4` | 3.0 – 4.0 | `mean >= 3` |
| `1-2.9` | 1.0 – 2.9 | `mean >= 1` |
| `0-0.9` | 0.0 – 0.9 | otherwise |

A section mean of 2.5 lands in `1-2.9`. A mean of 2.95 also lands in `1-2.9` — only `>= 3.0`
promotes.

**Final bands** — drive the ending knight pose (§3.4). From `summary_pose.score_range`:

| Band | Stated range | Rule |
| --- | --- | --- |
| `high_average` | 2.9 – 4.0 | `mean >= 2.9` |
| `average` | 1.7 – 2.8 | `mean >= 1.7` |
| `low_average` | 0 – 1.6 | otherwise |

The stated final ranges leave gaps (2.8→2.9 and 1.6→1.7). The `>=` thresholds above close them
deterministically: a mean of 2.85 is `average`, a mean of 1.65 is `low_average`. **Do not round the
mean before banding** — rounding 2.85 to 2.9 would silently promote a band.

Put all of this in one pure, unit-tested module, `src/game/scoring.ts`, imported by the results
screen, the section-end scene and the QWEN prompt builder alike. Test the boundaries explicitly:
`0, 0.9, 1.0, 1.6, 1.65, 1.7, 2.8, 2.85, 2.9, 2.95, 3.0, 4.0`.

---

## 5. QWEN integration

**Local endpoint for now.** Point `QWEN_BASE_URL` at a localhost OpenAI-compatible server
(e.g. `http://localhost:11434/v1`); there are no hosted credentials yet and `QWEN_API_KEY` may be
blank in local development. Hosted values arrive later and must be a pure `.env` change — **never
hardcode a vendor URL, model name or key anywhere in the source.**

Because the endpoint is usually *not* running during development, the fallback report (below) is
the path you will exercise most. Build it first.

- Server-side only. **The API key must never reach the browser.** Call from a Next.js route handler
  or server action, never from client code.
- Input: company name, industry, per-section scores, overall score, the chosen answer text for each
  question.
- Output: a short readiness summary plus concrete, prioritised next steps, tailored to the
  industry and the weakest sections.
- Return **structured output** (JSON with a fixed shape), validate it before rendering, and never
  inject model output as raw HTML.
- Handle: missing key, timeout, rate limit, malformed response. Each falls back to a deterministic
  template report built from the scores. **A QWEN outage must never block a player from seeing
  their score.**
- The system prompt and report tone are CMS-editable per mode.
- Cache or persist the generated report against the run id so a refresh doesn't re-bill a call.

---

## 6. Data & privacy

Player submissions contain company-identifying information, and §3.4 makes the result link
**shareable** — so the link is the access token. That raises the stakes on two things:

- **The run id must be unguessable** (uuid/nanoid, never a sequential integer). A shareable link
  built on `/results/1` means anyone can walk `/results/2` and read another company's readiness
  gaps. This is the single highest-impact mistake available in this codebase.
- **The permalink exposes only what a recipient should see**: the knight, the scores and the
  report. Return a narrow projection, not the whole submission document.
- Submissions are readable in `/admin` by authenticated users only — set explicit Payload access
  control, do not rely on defaults.
- Tell the player, on the intake form, that their answers are stored **and that their result link
  can be shared with anyone who has it**. One plain sentence each.
- Do not log answers or company names to stdout in production.

---

## 7. Backend model (Payload)

Design this yourself, but it must satisfy:

- A **`modes`** collection keyed by a URL slug (`default`, `electric`, …). A mode owns every
  swappable thing: backgrounds, knight sprites and poses, weapons, target objects, hit effects, UI
  theme, section titles and descriptions, questions and options, section animations, final-pose
  assets, and the QWEN prompt/tone.
- `default` is seeded from `ai_readiness_questions.json` + §3 defaults and must always exist.
  It is both the live default experience and the fallback source for every other mode.
- Routing: `/[mode]` renders that mode. **An unknown slug is a 404.** Do not fall back to `default`
  and do not redirect — a typo'd client URL must fail visibly, not silently serve the wrong brand.
- A new mode should be creatable by **duplicating** `default` in the admin UI, not by filling 60
  empty fields.
- **Per-slot fallback to `default`.** Every asset and text slot a mode leaves empty resolves to the
  `default` mode's value for that slot. A mode with one uploaded background and nothing else is
  valid and playable. Resolve this once, server-side, when loading the mode — never per-component.
- A **`submissions`** collection: knight name, company, industry, mode, per-question answers,
  scores, generated report, timestamps.
- Run `pnpm generate:types` after every schema change; import types from `@/payload-types`.
- Follow `.claude/skills/payload/SKILL.md` — in particular `overrideAccess: false` when acting on
  behalf of a user, and threading `req` through nested operations in hooks.

---

## 8. How to run this long task

### Working agreement

- **Plan before building.** Produce a short plan with the milestone list, the data model sketch,
  and your open questions. Get it approved before Milestone 2.
- **Write an ADR** (`docs/adr/`) for each irreversible choice: rendering approach (canvas vs DOM),
  animation technique, mode-duplication strategy, state persistence. One page each: options,
  choice, why, what it costs.
- **Keep a running `PROGRESS.md`** at the repo root: what's done, what's in flight, what's blocked,
  decisions taken. Update it at the end of every milestone. This is how work survives a session
  boundary — assume you will lose your context and write for your future self.
- **Commit per milestone**, with a message that says what now works.
- **Ask, don't guess** on anything where guessing wrong means rework. The decisions in §10 are
  already settled — don't reopen them; do raise anything new that §10 doesn't cover.
- **Do the whole milestone.** If part of it is blocked, finish everything else and say explicitly
  what you left out and why.
- **Never report a milestone complete without running it.** "It compiles" is not "it works".

### Milestones

Each milestone ends in something demonstrable.

**M1 — Foundations**
Confirm the DB connects, dev server runs, admin panel loads, first admin user creatable.
Write the plan and open questions. Add `QWEN_BASE_URL` / `QWEN_API_KEY` / `QWEN_MODEL` to
`.env.example` with the localhost default.
*Done when:* `pnpm dev` serves `/admin` against the real Postgres DB.

**M2 — Backend model**
`modes` + `submissions` collections, access control, seed script importing
`ai_readiness_questions.json` into the `default` mode. 3-section and 5-option constraints enforced.
*Done when:* `default` is fully populated in `/admin` and types regenerate clean.

**M3 — Game shell**
`/[mode]` route with 404 on unknown slug, per-slot fallback to `default`, title screen, intake
form, scene/state machine, save-and-resume. Placeholder art throughout.
*Done when:* you can enter a name and reach the first question screen in `/default`, and
`/nonsense` 404s.

**M4 — The archery section**
Full question screen contract (§3.2) for section 1, including hover bubble, click action,
back/replay, keyboard play, reduced-motion path. This is the reference implementation.
*Done when:* all 5 archery questions are playable end to end and answers persist.

**M5 — Boxing + swordsmanship**
Sections 2 and 3 as prop-driven reuse of M4. Section-end animations for all three.
*Done when:* all 15 questions are playable and all three section animations fire on the right band.

**M6 — Scoring and results**
`src/game/scoring.ts` with unit tests covering both band sets and every boundary in §4. Results
screen, final knight pose, shareable permalink on an unguessable run id.
*Done when:* a full playthrough shows a correct score and breakdown, the permalink reopens that
result in a fresh browser, and tests prove the band boundaries.

**M7 — QWEN report**
Server-side integration against the localhost endpoint, structured output, validation, fallback,
caching against the run.
*Done when:* a playthrough produces a tailored report when the local endpoint is up, **and** a
complete, useful fallback report when it is down.

**M8 — Default art set**
Generate the full `default` sprite and animation set per §3.5 and the `game-assets` skill, in one
consistent pass. Replace every placeholder. Record the prompts in `docs/art-prompts.md`.
*Done when:* `/default` is playable end to end with real art and no placeholder is reachable.
*Show the user the generated set before wiring all of it in* — restyling 40 assets after the fact
is expensive.

**M9 — Re-skin proof**
Duplicate `default` → `electric` in `/admin`, upload a *partial* asset set, verify `/electric`
renders the uploads and silently falls back to `default` for everything else. Document the process
in `docs/modes.md`.
*Done when:* someone non-technical could follow `docs/modes.md` and ship a new mode, and a mode
with only one uploaded asset is still fully playable.

**M10 — Hardening**
Playwright e2e for a full playthrough, Vitest for scoring and QWEN parsing, accessibility pass,
portrait "rotate to play" check, error states, README update.
*Done when:* `pnpm test` passes and the README tells a new developer how to run and extend this.

**M11 — Electric art set**
Finish `electric`: generate every remaining asset slot as an **electronic / cyberpunk re-skin of
the `default` set** per §3.5. M9 left `electric` deliberately partial (3 of 43 slots —
`art/electric/archery/target.idle`, `target.hit`, `hitEffect`); M11 fills the rest, in one
consistent pass, re-using the M8 pipeline (`scripts/art/process-set.mjs` constants, the same
render boxes, the same global knight scale) so electric sprites drop into the existing layout
pixel-for-pixel. Keep every prompt in the `docs/art-prompts.md` electric appendix.

**Questions are not in scope.** `electric`'s sections, questions, options and scores stay exactly
as `default` seeded them. Do not reword, reorder or re-score anything; the only text that may
differ is the mode title and the existing theme/copy fields M9 already set.

Three things this milestone has to resolve, not work around:
- `pnpm art:wire` is hardcoded to the `default` slug (`src/seed/wire-art.ts`). Make it take a mode
  slug and keep `default` the default.
- `scripts/art/verify-electric.mjs` asserts that most slots *do* resolve to `default` URLs. Those
  assertions invert once `electric` is complete — update the script so it proves the opposite:
  every slot resolves to an `electric` URL and no `default` URL is reachable in `/electric`.
- **Keep M9's per-slot fallback claim demonstrable.** It was proven *by* `electric` being partial,
  and a complete `electric` retires that evidence. Re-prove it on a throwaway scratch mode (create,
  verify, delete) or keep one named slot deliberately empty and assert it. Say which you chose in
  `docs/modes.md` and `PROGRESS.md`.

*Done when:* `/electric` plays end to end on electric art with zero `default` URLs and zero
placeholders reachable, `/default` is completely unchanged, the questions are byte-identical to
`default`'s, per-slot fallback is still proven somewhere, and all §8 gates are green.
*Show the user the sample before the full pass* — same gate as M8: the knight plus one section,
reviewed against the `default` originals side by side, before the remaining ~37 assets are made.

**M12 — Grounded targets + the `default16` mode**
Two deliverables that share one constraint, which is why they are one milestone: the floating-target
fix establishes the ground contract (§3.5), and `default16` is the first set generated under it.

**(a) Fix the floating targets.** In `/default` and `/electric`, the archery targets' legs do not
reach the floor — they hover above the background's ground plane. Fix the **archery** section of
both modes.

*Diagnose before regenerating anything.* There are two candidate causes and they have very
different costs:
- **Geometry** — `src/game/scenes/Question.tsx` puts the target row at `TARGET_TOP = 198` with
  `TARGET_SIZE = 200`, so a target's box bottom lands at stage Y **398**, while the backgrounds
  appear to draw their ground plane lower than that. If the row is simply too high, a constant
  change fixes every mode and every section at once, costs nothing, and generates no images.
- **Art** — the target sprites may carry transparent padding below the legs (the pipeline
  bottom-anchors into a 200×200 box, so padding reads as float), or the backgrounds may disagree
  with each other about where the floor is.

Measure both before choosing — read the alpha bounding boxes of the four existing archery target
sprites (`art/{default,electric}/archery/target.{idle,hit}@2x.png`) and the ground-plane Y of the
two archery backgrounds. Report the numbers. **Only regenerate the images the measurement actually
indicts**; a layout bug does not get fixed by redrawing art, and regenerating four sprites to
correct a constant is wasted spend. If the fix turns out to be geometry, say so plainly and change
the constant instead — the user asked for remade images, but they asked for them in order to stop
the floating, and the floating is the requirement.

Whatever the cause: `target.hit` must stay aligned with `target.idle` (they share a footprint —
the hit state must not jump), the stuck-projectile and hit-effect overlays must still land on the
target, and boxing/swordsmanship must be checked for the same defect even though the report came
from archery. Fix those too if they have it.

**(b) Write the contract down so it cannot recur.** Add the measured baseline Y and the target-row
geometry to `.claude/skills/game-assets/SKILL.md` as a named constant in the canonical-sizes table,
with the §3.5 standing rule restated as a failure mode. Add the ground-contact sentence to every
background and target prompt in `docs/art-prompts.md`. This is the part that protects `default16`
and every future mode.

**(c) Ship `default16`.** A full 43-slot set on the slug `default16`: a 16-bit SNES-era pixel-art
re-skin of `default` per §3.5, generated in one consistent pass under the ground contract from (b),
sample-gated as in M8/M11. `default` stays the live default experience and is not modified beyond
the (a) fix. Questions, options and scores are identical to `default` — do not touch them.

Pipeline notes, both of which will bite silently:
- `pnpm art:wire default16` **must work**, same as `pnpm art:wire electric` (M11 made the script
  slug-aware). Confirm it, don't rebuild it. Same for `node scripts/art/process-set.mjs default16`.
- **`sharp`'s default resampling will destroy pixel art.** Every `.resize()` in
  `process-set.mjs` uses the smooth default kernel, which turns hard pixel edges into mush at any
  scale. Use nearest-neighbour for this set, keep the scale factors integer where you can, and
  consider `image-rendering: pixelated` for the mode. A 16-bit set that has been lanczos-resampled
  looks like a blurry mistake, not a style.

*Done when:* no target floats in any section of `/default`, `/electric` or `/default16` (asserted,
not eyeballed — extend the verification scripts with a ground-contact check); `/default16` plays
end to end on its own art with zero `default` URLs and zero placeholders; `pnpm art:wire default16`
seeds the set from a clean state; `/default` and `/electric` are otherwise unchanged; the baseline
constant is written into the `game-assets` skill; and all §8 gates are green.
*Show the user the sample before the full pass* — the knight plus the archery section, with the
ground contact visible, against the `default` original.

**M13 — Music and sound effects**
Give the game a shared soundtrack and effect set per §3.7 — one set, every mode, static in the
repo, read through a single resolver.

**The set.** Keep it small and general; a tight set that is consistent beats a large one that
isn't (the same rule as the art pass). Target roughly a dozen files:

| Group | Cues |
| --- | --- |
| Music (looping) | title/intake · gameplay (one loop for all three sections) · results |
| Section feedback | attack (per section: bow release · punch · sword swish) · impact/hit |
| Scene stings | section-end, one per band (`0-0.9` · `1-2.9` · `3-4`) · results reveal |
| UI | hover/focus move · select/confirm · error |

Per-section attack and impact cues are the only section-aware sounds — everything else is global.
If a section cue is missing, fall back to the generic one rather than playing nothing.

**Where the audio comes from — decide and record it.** You have no audio-generation tool, so this
is a real choice and the milestone's main risk:
- **Synthesise it in a script** (recommended) — `scripts/audio/generate-set.mjs`, the same pattern
  as `scripts/art/`: deterministic, reproducible, license-clean by construction, regenerable when
  someone wants a different mood, and a chiptune/synth palette suits this game (and `default16`
  exactly). Node can write WAV with no dependency at all.
- **Source CC0 / public-domain audio** — faster to something polished, but every file needs its
  provenance and license recorded, and nothing with an attribution-only or non-commercial license
  may be committed.

Either way: record the choice and the per-cue source (script parameters or origin URL + license)
in `docs/audio.md`, the audio counterpart to `docs/art-prompts.md`, and write an ADR in
`docs/adr/` for the format and delivery decision.

**Two things that will bite:**
- **Encoding.** WAV needs no encoder and every browser plays it — fine for short effects, which
  are a few KB each. Music loops are the problem: 30 seconds of 44.1kHz stereo WAV is ~5MB, which
  violates §3.7's no-blocking rule in spirit. Prefer mp3/ogg if an encoder is actually available on
  this machine; if not, mono and a lower sample rate make WAV loops viable. **Check what's
  available before generating anything** rather than discovering it at the end.
- **The test suite.** The e2e suite drives 15 questions through real browsers; unlocked audio there
  is noise and flake. Make the muted path the default under test, and add coverage that matters:
  mute persists across a reload, and a deliberately broken sound file does not stop a question from
  advancing (the §3.7 degradation rule, asserted the same way the QWEN fallback is).

**Keep it out of the way of the game.** No scene's timing changes to accommodate a sound; the
700ms attack choreography (ADR 0003) stays exactly as it is and the audio fits inside it. If a cue
is longer than its beat, trim the cue, not the beat.

*Done when:* a full playthrough of `/default` has music and effects at every cue above, the same
set plays in `/electric` and `/default16`, mute is reachable by keyboard on every scene and
survives a reload, no console autoplay or decode errors on any route, a corrupted sound file still
leaves the game fully playable, `docs/audio.md` + the ADR explain where every cue came from, and
all §8 gates are green.
*Play it before calling it done* — this is a milestone where "the tests pass" is especially far
from "it sounds right". Report what you actually heard.

**M14 — Asset weight and the loading screen**
The game visibly streams its art in during play. A loading screen is part of the answer but not the
cause: **the assets are enormous.** Measured 2026-10-14, before any work:

```
art/            64 MB total          art/default/   25 MB
120 PNGs        art/electric/  22 MB  art/default16/ 18 MB

largest:  default/title/background@2x.png        5.14 MB
          default/boxing/background@2x.png       4.28 MB
          default/swordsmanship/background@2x    3.90 MB
          … every background is 3–5 MB
```

`src/collections/Media.ts` is a bare `upload: true` — **no `formats`, no `imageSizes`, no resize**
— so Payload serves those originals byte-for-byte, and `Sprite.tsx` requests each one with a plain
`<img>` at the moment its scene first renders. Roughly 20 MB of a mode's 25 MB is backgrounds.
Preloading alone would just move the same 25 MB in front of the player and make them watch it.

Do these in order; each one makes the next cheaper.

**(a) Make the assets small.** Re-encode for delivery — WebP (or AVIF) at quality ~80 should take a
4 MB background under 500 KB with no visible loss at 1280×720. This is a **re-encode, not a
regeneration**: do not call an image generator, do not re-run `process-set.mjs`'s generation path,
and do not disturb composition — M12's `GROUND_BASELINE_Y` contract and `check-ground.mjs` must
still pass untouched afterwards. Two cautions: **`default16` is pixel art** and lossy encoding
smears hard pixel edges — use lossless WebP or a quantised PNG for that set and verify by eye at
1:1; and sprites have alpha, so whatever format you pick must preserve transparency. Decide where
this belongs — a Payload `formats`/`imageSizes` config so uploads are converted on the way in, a
step in the art pipeline, or both — and say why in an ADR. Unlike M13's audio, there is no missing
tool here: `sharp` is already a dependency and encodes WebP and AVIF natively.

M13's audio set (`public/audio`, 2.5 MB of WAV across 15 cues) is small beside the art, but it is
static and shared, so fold it into the same cache-header decision in (b) and keep the music loops
out of the blocking preload in (c) — a sound effect arriving a second late is invisible; a
background arriving late is the whole complaint.

**(b) Cache properly.** Media is immutable once uploaded; it should be served with long-lived
cache headers so a replay, a back-navigation or a second visit costs nothing. Verify what Payload
sends today before changing anything.

**(c) Preload the first scene behind a loading screen** — title plus intake plus section 1, not all
43 slots. Determinate progress from real request completions, a timeout that starts the game
anyway, and the §3.8 rules.

**(d) Prefetch the rest during play.** Sections 2 and 3 fetch while the player answers section 1;
the results assets fetch during section 3. A scene transition must never block on a download. The
existing scene machine knows exactly where the player is — use it rather than inventing a second
notion of progress.

**Re-wiring is part of the job, not an afterthought.** Changing encodings changes filenames, and
`art:wire` finds-or-creates media by filename — so all three modes need re-wiring, `REPLACE=1`
semantics need checking, and `verify-electric.mjs` / `verify-default16.mjs` assert on resolved
URLs and will need updating. Re-run every mode's verification afterwards: a mode silently falling
back to `default` because its re-encoded upload didn't bind is exactly the failure this invites.

*Done when:* `art/`'s delivered weight per mode is reported before and after (state the real
numbers), `/default`, `/electric` and `/default16` each start behind a loading screen that ends on
real completion, **no background or sprite visibly pops in during a playthrough on a throttled
connection** (test it throttled — on localhost everything looks instant and you will prove
nothing), a stalled asset still lets the game start, `check-ground.mjs` and all three verify
scripts pass, `default16` is confirmed un-smeared at 1:1, and all §8 gates are green.
*Report the measured before/after sizes in `PROGRESS.md`* — this milestone's whole claim is a
number.

### Verification you owe on every milestone

Run `pnpm lint`, `pnpm test`, and actually open the app. Report failures with the real output —
never summarise a failing test as passing, and never mark a milestone done because the remaining
part looked small.

---

## 9. Skills available in `.claude/skills/`

Read the relevant `SKILL.md` **before** writing code in that area.

| Skill | Read it before |
| --- | --- |
| `payload` | Any collection, field, hook, access-control, or query work. |
| `knight-game` | Scene/state machine, question screen, animation, persistence, accessibility. |
| `game-assets` | Naming, sizing, spritesheet layout, placeholder strategy for every art slot. |
| `game-modes-cms` | The `modes` data model, duplication, routing, fallbacks. |
| `qwen-report` | The QWEN call, structured output, validation, fallbacks, key safety. |

---

## 10. Settled decisions

Answered by the user on 2026-10-13. **Treat these as constraints, not suggestions.** Do not reopen
them; if one turns out to be unbuildable, say so and stop rather than quietly substituting.

| # | Decision | Where it binds |
| --- | --- | --- |
| 1 | **QWEN runs on localhost for now.** No hosted credentials. Base URL, model and key are all `.env`-driven; nothing vendor-specific in source. | §5 |
| 2 | **Bands are means, with two separate band sets.** Sections: `0-0.9` / `1-2.9` / `3-4` — so a 2.5 mean is mid-band. Final pose: `>=2.9` / `>=1.7` / else. | §4 |
| 3 | **Landscape everywhere.** Desktop and tablet, both landscape. No portrait layout; portrait gets "rotate to play". | §3.6 |
| 4 | **You generate the `default` art.** Other modes are supplied by the backend user, and anything they don't upload falls back to `default`. | §3.5, §7, M8 |
| 7 | **You generate the full `electric` art too** (added 2026-10-13, amends #4 for this one mode). `electric` is an electronic/cyberpunk **re-skin of `default`** — same compositions, poses and anchors, restyled; its questions stay identical to `default`'s. Every other mode still follows #4. | §3.5, M11 |
| 8 | **Targets never float** (added 2026-10-14). Everything that stands on the ground touches it, in every mode and section — a contract between the background's ground plane and the sprite's alpha bbox, with one measured baseline Y recorded in the `game-assets` skill. | §3.5, M12 |
| 9 | **`default16` is a third in-house set** (added 2026-10-14). A 16-bit SNES-era pixel-art re-skin of `default`, slug `default16`, seeded by `pnpm art:wire default16`. `default` remains the live default experience; questions stay identical. | §3.5, M12 |
| 10 | **Audio is one shared static set, not per-mode CMS content** (added 2026-10-14). The same music and effects play in every mode; they live in the repo, not the `modes` collection, and are read through one resolver so they can be promoted to CMS later without a rewrite. Web audio formats, never MIDI. Sound is always optional — muted play is fully supported. | §3.7, M13 |
| 11 | **The player waits once, up front** (added 2026-10-14). Assets ship compressed, the first scene preloads behind a bounded loading screen, and later sections prefetch during play. Re-encoding art for delivery is never a reason to regenerate it, and must not disturb M12's ground contract. | §3.8, M14 |
| 5 | **Unknown mode slug → 404.** No fallback, no redirect. | §7 |
| 6 | **Results permalink is shareable and permanent.** Which is exactly why the run id must be unguessable. | §3.4, §6 |


