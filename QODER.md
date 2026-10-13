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
| 5 | **Unknown mode slug → 404.** No fallback, no redirect. | §7 |
| 6 | **Results permalink is shareable and permanent.** Which is exactly why the run id must be unguessable. | §3.4, §6 |


