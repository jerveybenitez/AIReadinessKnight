---
name: game-modes-cms
description: Use when modelling or changing the AI-Ready Knight Payload backend — the modes collection, per-mode re-skinning, sections and questions, asset slots, submissions, /[mode] routing, seeding the default mode from ai_readiness_questions.json, mode duplication, or the 3-section / 5-option constraints. Use when a mode renders wrong, a slug 404s, or an admin edit doesn't reach the game.
---

# AI-Ready Knight — Modes & CMS

The backend exists for one purpose: let a non-developer ship a re-skinned variant of the game at a
new URL without touching code. Design every decision against that test.

Read `.claude/skills/payload/SKILL.md` first for Payload mechanics. This skill covers what is
specific to this game.

## The shape

```
modes (collection)
├── slug            unique, indexed, url-safe  ("default", "electric")
├── title
├── theme           colours, fonts, UI skins
├── titleScreen     background, logo, copy
├── sections[3]     EXACTLY three — ordered, each with a stable id
│   ├── key         'archery' | 'boxing' | 'swordsmanship'  (stable, never reordered away)
│   ├── name, description, icon
│   ├── assets      background, knight poses, targets, projectile, hit effect
│   ├── sectionAnimation  { low, mid, high } — text spec + asset per band
│   └── questions[5]
│       ├── id      stable
│       ├── text
│       └── options[5]  { text, score }  — score 0..4, ordered ascending
├── results         background, finalKnight { low_average, average, high_average }
└── ai              QWEN system prompt, tone, extra guidance for this client

submissions (collection)
├── runId           unguessable (uuid/nanoid), unique, indexed  ← public-facing id
├── mode            relationship -> modes
├── knightName, companyName, industry
├── answers[]       { questionId, optionIndex, score }   one per question id
├── scores          per-section means + final mean + bands
├── report          generated QWEN report (cached)
└── timestamps
```

## Hard constraints to enforce in config

These are stated in the brief, so make them structural rather than conventional:

- **Exactly 3 sections.** `minRows: 3, maxRows: 3` on the array, plus a `validate` that checks the
  three `key` values are present and distinct.
- **Exactly 5 options per question**, scores 0–4 ascending. The entire screen layout assumes 5
  targets; a 4-option question is a broken screen, not a smaller one. Validate on save so the
  error surfaces in `/admin`, not at runtime in the game.
- **Unique, url-safe slug.** Reject slugs that collide with app routes (`admin`, `api`, `_next`).

Enforcing these in the collection config is the difference between an admin seeing a red field and
a player seeing a blank screen.

## Seeding `default`

Write an idempotent seed script (`pnpm payload` / a `src/seed/` module) that:

1. Reads `ai_readiness_questions.json` — the source of truth for all 15 questions, section names,
   descriptions, icons and `section_animation` text.
2. Maps `game_training` → section `key` (`archery`, `boxing`, `swordsmanship`).
3. Carries the `section_animation` keys through **verbatim** — `0-0.9`, `1-2.9`, `3-4`. These are
   the section band keys; see `knight-game` for the banding rules. Don't normalise or rename them.
4. Leaves asset slots empty at first — dev placeholders cover them, then the generated `default`
   art set fills them (see `game-assets`).
5. Is safe to re-run: upsert by slug, don't duplicate.

`default` must always exist. The game's own smoke test is that `/default` is playable.

## Routing

```
src/app/(frontend)/[mode]/page.tsx
```

- Load the mode by slug server-side, pass it down. The game never fetches the mode from the client.
- **Unknown slug → `notFound()`. A 404.** No fallback to `default`, no redirect. A typo'd client
  URL must fail visibly rather than silently serving another client's branding. Note this is the
  opposite of the *asset* fallback below — a missing **mode** 404s, a missing **slot** falls back.
- `(payload)` routes own `/admin` and `/api`. Make sure `[mode]` cannot shadow them — this is the
  most likely routing bug in the whole project.
- Consider `generateStaticParams` + revalidation for mode data, but **never** cache a submission or
  a report at the route level.

## Duplication — the feature that makes modes usable

Creating `electric` must mean "duplicate `default`, then change what differs". Filling 60 empty
fields is a failed design.

Options, roughly in order of preference:

1. Payload's built-in **duplicate** action on the collection, if it deep-copies the nested
   structure correctly — test it with a fully populated `default` before relying on it.
2. A custom admin action / endpoint that reads a source mode and writes a copy with a new slug.
3. A `copyFrom` relationship field handled in a `beforeChange` hook on create.

Whichever you pick: assets may be **referenced**, not re-uploaded. Two modes pointing at the same
`media` doc is correct and cheap.

## Fallbacks

**Backend users supply their own art; anything they don't supply comes from `default`.** This is a
stated requirement, not an optimisation. A mode with one uploaded background and nothing else must
be fully playable.

Resolve every field through the chain:

```
mode.field  →  default mode's field  →  dev placeholder
```

Implement this **once, server-side, when loading the mode** — not per-component. A component that
writes `mode.sections[0].assets.background ?? somethingElse` has leaked the fallback rule, and the
next component will leak it differently.

Practical consequences:

- `default` must be complete before any other mode is useful. It is the fallback source, not just
  the first mode.
- Resolution happens against the **merged** mode, so downstream code never sees a null slot and
  never branches on one.
- Surface incompleteness in `/admin` (a "this mode inherits N slots from default" indicator) so an
  editor knows what they still owe before a client does.
- Do not fall back **questions** silently the way you fall back assets without saying so — a mode
  inheriting `default`'s wording is correct, but the editor should be able to see that it is
  inherited rather than authored.

## Access control

Set it explicitly; the scaffold's defaults are not what you want here.

- `modes`: public **read** (the game needs it, unauthenticated), authenticated write.
- `submissions`: **no public read.** Create is public (the game posts answers). Read/update/delete
  are admin-only. Results are served by a dedicated endpoint keyed on the unguessable `runId`,
  returning only that run's safe fields — scores, band, pose and report, never the whole document.
- **Result links are shareable and permanent** by product decision, so the `runId` is the only
  access control on them. That makes "unguessable" a security requirement, not a style preference.
- Submissions carry company names and self-assessed weaknesses. Treat the collection as
  confidential, not as analytics exhaust.
- When any server code acts on behalf of a player, pass `overrideAccess: false`.

## Common failure modes

1. **Section identity by array index.** An editor reorders sections and every stored answer points
   at the wrong one. Use the stable `key`/`id`.
2. **Question identity by index**, same bug, worse: previously stored submissions become nonsense
   when a question is edited. Give questions stable ids at seed and never regenerate them.
3. **Public read on `submissions`.** Leaks every client's company name and readiness gaps. Check
   this explicitly; it is the single highest-impact mistake available in this codebase.
4. **Sequential ids in result URLs.** Same leak by enumeration. Use `runId`.
5. **Stale types.** Run `pnpm generate:types` after every schema change; a stale
   `payload-types.ts` makes TypeScript confidently wrong.
6. **Validation only in the game.** The editor finds out from a broken page instead of a form error.
7. **Caching the mode too aggressively**, so an admin edit doesn't show up and someone concludes
   the CMS is broken. Revalidate on `afterChange`.
