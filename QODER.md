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

1. **No QWEN credentials in `.env`.** The brief says they will be supplied. Build against
   `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`, add them to `.env.example`, and make the app
   degrade gracefully (deterministic template-based report) when the key is absent. **Ask the user
   for the real values before attempting a live call.**
2. **No art assets exist yet.** `game_concept/` holds wireframes, not sprites. Every image is a
   CMS-managed upload with a documented placeholder fallback. Ship playable placeholders
   (flat-colour shapes with labels); real art drops in later via `/admin` with no code change.
3. **`ai_readiness_questions.json` has a typo** — `"kingt punches bag"` in the `talent` section.
   Fix on seed, leave the source file untouched.
4. **Scoring interpretation is an assumption.** See §4; confirm with the user before building the
   results screen.

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

All three sections share one layout; only the props differ.

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
- Shareable: give the run a unique id and a permalink so the player can return to their result.

### 3.5 Art direction

2D anime-style sprite art, Pokémon-era flat pixel/sprite feel. The knight is a **girl**.
Background is a simple medieval training barracks — clean and readable, deliberately uncluttered.
Keep the background a single CMS-swappable image per section so re-skinning is trivial.

### 3.6 Non-negotiable UX baseline

- Playable with keyboard alone (arrow keys / tab to move between targets, Enter to choose).
- Every target has an accessible name equal to its option text; the speech bubble is not the only
  way to read an option.
- Respects `prefers-reduced-motion`: animations collapse to instant state changes, game stays
  fully playable.
- Works at 1280×720 and scales down to tablet. Mobile is nice-to-have, not required — confirm with
  the user if you plan to cut it.
- Progress survives an accidental refresh mid-run.

---

## 4. Scoring — confirm before building §3.4

Reading of `ai_readiness_questions.json`:

- Each question scores 0–4. 5 questions × 3 sections = **60 points max**.
- `section_animation` keys (`"0"`, `"1-2"`, `"3-4"`) and `summary_pose.score_range`
  (`high_average: [4, 2.9]`, `average: [2.8, 1.7]`, `low_average: [1.6, 0]`) are both expressed on
  a **0–4 scale**, so both are **mean score per question**, not totals.
  - Section band = mean of that section's 5 answers, rounded to the nearest band.
  - Final band = mean of all 15 answers.
- Note the ranges are written high-value-first and leave a gap between `2.9` and `2.8`; treat the
  bands as `[2.9, 4.0]`, `[1.7, 2.8]`, `[0, 1.6]` and resolve the boundary gaps explicitly in code.

**Ask the user to confirm this interpretation** before the results screen is built. Put the rule in
one pure, unit-tested module (`src/game/scoring.ts`) so changing it is a one-file edit.

---

## 5. QWEN integration

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

Player submissions contain company-identifying information. Therefore:

- The results API must not allow enumerating other people's runs (use unguessable ids, not
  sequential integers, in any public URL).
- Submissions are readable in `/admin` by authenticated users only — set explicit Payload access
  control, do not rely on defaults.
- Tell the player, on the intake form, that their answers are stored. One plain sentence.
- Do not log answers or company names to stdout in production.

---

## 7. Backend model (Payload)

Design this yourself, but it must satisfy:

- A **`modes`** collection keyed by a URL slug (`default`, `electric`, …). A mode owns every
  swappable thing: backgrounds, knight sprites and poses, weapons, target objects, hit effects, UI
  theme, section titles and descriptions, questions and options, section animations, final-pose
  assets, and the QWEN prompt/tone.
- `default` is seeded from `ai_readiness_questions.json` + §3 defaults and must always exist.
- Routing: `/[mode]` renders that mode. Unknown slug → clear 404 or fall back to `default`
  (pick one, document it).
- A new mode should be creatable by **duplicating** `default` in the admin UI, not by filling 60
  empty fields.
- Every asset slot has a documented fallback so a half-configured mode still renders.
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
- **Ask, don't guess**, on: QWEN credentials, scoring interpretation (§4), mobile support, art
  asset sourcing, and anything where guessing wrong means rework.
- **Do the whole milestone.** If part of it is blocked, finish everything else and say explicitly
  what you left out and why.
- **Never report a milestone complete without running it.** "It compiles" is not "it works".

### Milestones

Each milestone ends in something demonstrable.

**M1 — Foundations**
Confirm the DB connects, dev server runs, admin panel loads, first admin user creatable.
Write the plan and open questions. Add QWEN keys to `.env.example`.
*Done when:* `pnpm dev` serves `/admin` against the real Postgres DB.

**M2 — Backend model**
`modes` + `submissions` collections, access control, seed script importing
`ai_readiness_questions.json` into the `default` mode. 3-section and 5-option constraints enforced.
*Done when:* `default` is fully populated in `/admin` and types regenerate clean.

**M3 — Game shell**
`/[mode]` route, mode loading, title screen, intake form, scene/state machine, save-and-resume.
Placeholder art throughout.
*Done when:* you can enter a name and reach the first question screen in `/default`.

**M4 — The archery section**
Full question screen contract (§3.2) for section 1, including hover bubble, click action,
back/replay, keyboard play, reduced-motion path. This is the reference implementation.
*Done when:* all 5 archery questions are playable end to end and answers persist.

**M5 — Boxing + swordsmanship**
Sections 2 and 3 as prop-driven reuse of M4. Section-end animations for all three.
*Done when:* all 15 questions are playable and all three section animations fire on the right band.

**M6 — Scoring and results**
`src/game/scoring.ts` with unit tests, results screen, final knight pose, permalink.
*Done when:* a full playthrough shows a correct score and breakdown, with tests proving the bands.

**M7 — QWEN report**
Server-side integration, structured output, validation, fallback, caching.
*Done when:* a real playthrough produces a tailored report, and killing the API key still yields a
usable fallback report.

**M8 — Re-skin proof**
Duplicate `default` → `electric` in `/admin`, swap assets and questions, verify
`/electric` renders the variant with no code change. Document the process in `docs/modes.md`.
*Done when:* someone non-technical could follow `docs/modes.md` and ship a new mode.

**M9 — Hardening**
Playwright e2e for a full playthrough, Vitest for scoring and QWEN parsing, accessibility pass,
error states, README update.
*Done when:* `pnpm test` passes and the README tells a new developer how to run and extend this.

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

## 10. Open questions for the user

Collect answers before they block you; don't stall on the ones that don't.

1. QWEN credentials and endpoint — base URL, model name, key.
2. Confirm the scoring interpretation in §4.
3. Is mobile/portrait support required, or is desktop + tablet enough?
4. Who supplies the final sprite art, and in what format? (Affects §3.5 and the `game-assets` skill.)
5. Unknown mode slug: 404, or fall back to `default`?
6. Is a shareable results permalink wanted, or should a run be single-use?
