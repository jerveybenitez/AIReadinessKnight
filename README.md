# AI-Ready Knight

A gamified **AI-readiness assessment**. The player is a knight in training: she answers the
company's AI-readiness questionnaire across three disciplines — **archery, boxing and
swordsmanship** — and each discipline ends with an animated beat that reflects her band. The run
finishes on a results screen with a score breakdown and a permalink, plus a short AI-readiness
report written (or fallback-generated) by a QWEN-compatible chat endpoint.

Built on **Payload 3 + Next.js** (App Router). The whole experience is CMS-driven: questions,
copy, theme colours and every sprite are stored in a Payload collection called **Modes**, so a new
"skin" or a new question set never requires a code change.

This file tells you how to **run** it and how to **extend** it. The contract and build log live in
[`QODER.md`](QODER.md) (§8 milestone plan) and [`PROGRESS.md`](PROGRESS.md).

---

## Prerequisites

- **Node.js ≥ 20.18.1** (see `engines` in `package.json`)
- **pnpm 9 or 10 or 11**
- **PostgreSQL** — a local server, or use the optional [`docker-compose.yml`](docker-compose.yml)
  (Postgres only; the app itself runs on the host).
- Optional, for tailored AI reports: any **OpenAI-compatible chat-completions endpoint**
  (local `llama.cpp` / Ollama / LM Studio, or a hosted QWEN). Everything about it is `.env`-driven
  — see [The QWEN report](#the-qwen-report).

## Quick start

```bash
# 1. Configure
cp .env.example .env
#    → fill in DATABASE_URL (Postgres) and PAYLOAD_SECRET (a long random string)

# 2. Install and seed
pnpm install
pnpm seed          # creates the "default" mode from ai_readiness_questions.json (idempotent)

# 3. Run
pnpm dev           # http://localhost:3000
```

- `/` redirects to `/default` — the playable mode.
- `/admin` opens the Payload admin. **The first visit asks you to create the first user**
  (that user becomes the admin). Open a run's submission under *Submissions* to see answers,
  scores and the cached report.
- If you use the compose file for Postgres, boot it with `docker compose up -d` first and point
  `DATABASE_URL` at `postgres://payload:payload@127.0.0.1:5432/ai_ready_knight` (the values the
  compose file creates).

### Optional: a local database in Docker

`docker-compose.yml` runs **only a Postgres** for development:

```bash
docker compose up -d          # Postgres on 127.0.0.1:5432
# DATABASE_URL=postgres://payload:payload@127.0.0.1:5432/ai_ready_knight
```

The stock `Dockerfile` is the generic Next standalone template and is **not set up here**
(it expects `output: 'standalone'` and a `public/` folder; neither exists in this repo). Use it as
a starting point if you deploy in a container — the app is conventionally run with `pnpm dev`
locally and `pnpm build && pnpm start` otherwise.

## How the game works

1. **Title** — mode logo/background, start.
2. **Intake** — company name + industry. A run (`submission`) is created server-side and its id is
   kept client-side, so a refresh resumes the run mid-flight.
3. **Three sections** (archery → boxing → swordsmanship), 5 questions each. Click the answer the
   company best matches; the knight attacks, the target reacts, a small toast of score arrives.
4. **Section end** — an animated beat whose pose/effect depends on the section's band
   (`0–0.9`, `1–2.9`, `3–4`).
5. **Results** — overall band, mean, per-section breakdown, a final knight portrait per band, and
   the report. The URL is a **permalink** (`/result/<runId>` on an unguessable id) — anyone opening
   it in a fresh browser sees the same result without replaying.
6. **Report** — one QWEN call per run, cached on the submission (refreshing never re-bills); when
   the endpoint is down the deterministic fallback report is shown instead, still complete.

## Modes — re-skinning and new question sets

A **mode** is one row in the `Modes` collection: slug, title, theme accent, the three sections
(questions, copy, assets) and logo/background per screen. Routing is `/<mode-slug>`
(`/default`, `/electric`, …). Resolution is **per slot, not per mode**: a mode that leaves a slot
empty silently inherits the matching slot from the mode whose slug is `default`.

To add a mode, the whole process is: admin → **Modes** → *Duplicate* the `default` row → edit
title/slug/theme → upload only the art you have. The full click-through guide, including the
fallback rules and gotchas, is in [`docs/modes.md`](docs/modes.md).

## Art pipeline

The game's art is generated with image models, then processed to strict canvases. The repo keeps
both ends:

- `vibe_images/` — raw generated images (the source of record).
- `art/` — processed, transparent, @2x sprites placed on canonical canvases
  (`art/default/<section>/…` and `art/electric/<section>/…` — both sets are complete).
- `docs/art-prompts.md` — **every prompt actually used**, keyed by slot, plus the pipeline
  conventions (white-key, trimming, anchors, canvas sizes). Read this before regenerating anything.

Processing scripts live in `scripts/art/` (run with plain `node`, they use `sharp`):
`process-set.mjs <set>` handles both sets (`node scripts/art/process-set.mjs electric`; no argument
= `default`), and `compare-sets.mjs <section>` renders the set-vs-set side-by-side review sheet the
re-skin sample gate uses (`docs/art-sample/compare-electric-<section>.png`). After processing,
upload + wire a set into the CMS with:

```bash
pnpm art:wire            # wire the default set: find-or-create each media doc, point default's slots at them
pnpm art:wire electric   # wire another mode: art/<slug>/** → the mode with that slug (media names get the <slug>- prefix)
pnpm art:wire --replace  # re-upload files that changed on disk
```

Verification: `node scripts/art/verify-electric.mjs` plays `/electric` end to end asserting zero
`default` URLs and zero placeholders; `pnpm art:verify-fallback` re-proves the per-slot fallback
on a throwaway scratch mode (see [`docs/modes.md`](docs/modes.md)).

## The QWEN report

`src/game/report-server.ts` calls an OpenAI-compatible chat-completions endpoint and validates a
strict JSON shape; `src/game/report.ts` owns the prompt-independent parsing + the deterministic
fallback. The endpoint is **entirely `.env`-driven** (nothing vendor-specific in source):

| Variable | Meaning |
| --- | --- |
| `QWEN_BASE_URL` | Base URL, e.g. `http://localhost:11434/v1`. Blank/unset → fallback report. |
| `QWEN_API_KEY` | Optional. Blank sends no `Authorization` header (normal for local servers). |
| `QWEN_MODEL` | Optional model name. |
| `QWEN_DISABLE_THINKING` | `true` adds `enable_thinking: false` — for hybrid-reasoning models (qwen3.x) that otherwise burn their budget thinking. |

The prompt contains the company's answers; it is never logged, and neither are responses. Every
failure mode (missing config, network, timeout, non-2xx, malformed JSON, invalid shape) degrades
to the fallback report, so the player always gets a complete report.

## Tests

```bash
pnpm test:int    # Vitest — scoring bands, QWEN parsing + fallback, machine, API, mode resolver
pnpm test:e2e    # Playwright — full playthrough, report-once + permalink, admin, a11y, portrait
pnpm test        # both, in that order
pnpm lint        # ESLint
```

Notes for a new developer:

- `pnpm test:int` uses the same `.env` database and does not need the dev server.
- `pnpm test:e2e` starts `pnpm dev` itself **or reuses one already on :3000**. Because of that:
  **before running e2e (or any test), point the running dev server at a dead endpoint** so a real
  endpoint is never billed: `QWEN_BASE_URL=http://127.0.0.1:9/v1 pnpm dev`. The suite works fully
  offline — it asserts the *fallback* report path.
- Playwright normally uses its bundled Chromium. If that download is unavailable, run against a
  system browser: `PW_CHANNEL=chrome pnpm test:e2e` (or `msedge`).

## Project map

| Path | What lives there |
| --- | --- |
| `src/app/(frontend)/` | The game: `/[mode]` route, `/result/[runId]` permalink, styles. |
| `src/app/(payload)/` | Payload admin + REST/GraphQL API mount points. |
| `src/game/` | Game engine: `machine.ts` (state machine), `scoring.ts`, `mode-loader.ts` (per-slot fallback), `run-server.ts`/`run-client.ts` (persistence), `report-server.ts`/`report.ts` (QWEN + fallback), `components/`, `scenes/`, `game.css`. |
| `src/collections/` | `Modes` (the whole CMS model), `Media`, `Submissions` (runs + cached reports), `Users`. |
| `src/endpoints/runs.ts` | The game API (create run, save answer, fetch snapshot). |
| `src/seed/` | `seedDefaultMode` (`pnpm seed`), `wire-art.ts` (`pnpm art:wire`). |
| `scripts/art/` | Image processing (raws → `art/`), `scripts/re-skin-proof.mjs` (admin-walkthrough proof). |
| `tests/int/`, `tests/e2e/` | Vitest and Playwright suites. |
| `docs/` | `modes.md` (re-skin guide), `art-prompts.md` (prompt log), `adr/` (rendering, persistence, animation, permalink decisions). |
| `vibe_images/`, `art/` | Raw generations and processed sprites. |

The questions seed from `ai_readiness_questions.json`; the concept notes live in `game_concept/`.
Signed-in admin sessions, the `media/` uploads folder and `.env` are local-only (gitignored).
