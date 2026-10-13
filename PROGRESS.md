# PROGRESS — AI-Ready Knight

> Build brief: `QODER.md`. Original human brief: `Qoder.txt` (wins on conflict).
> Skills in `.claude/skills/` — read the relevant one before touching that area.
> This file is how work survives a session boundary: assume you lose the chat and write for your
> future self. Update it at the end of every milestone.

Last updated: 2026-10-13

## Milestone status

| # | Milestone | Status | Notes |
| --- | --- | --- | --- |
| M1 | Foundations | **complete** | DB ✓ · dev server ✓ · `/admin` 200 ✓ · first admin user created via UI ✓ · plan below |
| M2 | Backend model | **complete** | `modes` + `submissions` collections, explicit access control, idempotent seed of `default`; verified via /admin UI, REST API and psql (see log below) |
| M3 | Game shell | **complete** | `/[mode]` routing + fallback resolver, title/intake/question/section-end/results scenes on a scaled 1280×720 stage, pure scene machine, server-run resume; verified in a real browser (see log below) |
| M4 | Archery section | **complete** | question screen is fully art-driven (targets/bubble/attack choreography); verified live end to end in a real browser + e2e (see log below) |
| M5 | Boxing + swordsmanship | **complete** | sections 2/3 are prop-driven reuse of the M4 reference; band-driven section-end animation (text + asset slot + knight pose); verified live with all 15 questions and all three bands (see log below) |
| M6 | Scoring + results | **complete** | results screen (final knight per band, overall + per-section breakdown), permanent shareable permalink `/result/<runId>` on the unguessable run id, `?run=` adoption for unfinished runs; verified live + e2e incl. a fresh-browser permalink reopen (see log below) |
| M7 | QWEN report | **complete** | server-side generation (env-driven, `QWEN_DISABLE_THINKING` for the hybrid reasoning model), schema-validated structured JSON, deterministic per-band fallback, cached once per run on the submission; verified live against the hosted endpoint (tailored report in 6.6s) **and** with the endpoint dead (complete template report) — see log below |
| M8 | Default art set | pending | needs user sample check before full set |
| M9 | Re-skin proof (`electric`) | pending | |
| M10 | Hardening | pending | |

## M1 verification log (2026-10-13)

- `pnpm dev` starts (Turbopack, ~21s first ready). First `/admin` request took 2min (cold compile +
  Postgres schema push), subsequent requests ~20s / cached.
- `/admin` → HTTP 200, redirects to create-first-user when no users exist. Payload pushed schema:
  tables `users`, `users_sessions`, `media`, `payload_kv`, `payload_locked_documents`,
  `payload_preferences`, `payload_migrations` all present in Postgres.
- First admin **created through the real UI form** (not a script): email
  `admin@ai-ready-knight.local` — password was set during M1 and shared in the session chat; it is a
  local-dev-only credential. To reset: `pnpm payload run <script>` with a `users` update, or delete
  the row and reload `/admin` (a fresh one will be created). Row verified in DB:
  `select id,email,created_at from users` → `1 | admin@ai-ready-knight.local`.
- **Scaffold repairs made in M1** (needed to satisfy "run `pnpm lint` every milestone"):
  - `eslint.config.mjs` rewritten: the scaffold used `FlatCompat` from `@eslint/eslintrc`, which
    isn't in `package.json`; after installing it, it still crashed because `eslint-config-next@16`
    is flat-config-native ("property 'react' closes the circle" circular-config error). Now it
    imports `eslint-config-next/core-web-vitals` + `/typescript` directly. Custom rules and ignores
    preserved. `@eslint/eslintrc` not needed and not kept.
  - `pnpm lint` → 0 errors, 5 warnings (all pre-existing in scaffold test files).
  - `pnpm test:int` → 1 passed. `pnpm test:e2e` → needs Playwright chromium: installed during M1
    (`pnpm exec playwright install chromium`); re-run pending. Scaffold `frontend.e2e.spec.ts`
    asserts the placeholder homepage ("Payload Blank Template") — it must be **updated in M3** when
    the real frontend replaces `src/app/(frontend)/page.tsx`.

## M2 verification log (2026-10-13)

Files added: `src/game/constants.ts` (canonical keys), `src/collections/Modes.ts`,
`src/collections/Submissions.ts`, `src/seed/default-mode.ts`, `src/seed/run.ts`; `payload.config.ts`
registers the two collections; `package.json` gained `pnpm seed`.

- **Key discovery**: Payload 3's default access is `Boolean(user)` (authenticated-only), verified in
  `node_modules/payload/dist/auth/defaultAccess.js` — not "public by default". So only `modes` and
  `media` need an explicit public `read: () => true`; everything else is locked unless opened.
- **Constraints enforced in config**: sections array `minRows: 3, maxRows: 3` + validate (keys
  distinct and complete archery/boxing/swordsmanship); `sectionAnimation` rows validate the three
  band keys `0-0.9 / 1-2.9 / 3-4`; questions `minRows/maxRows: 5` + unique-id validate; options
  `minRows/maxRows: 5` + validate scores must equal `[0,1,2,3,4]` in order; slug regex + reserved
  list (`admin`, `api`, `_next`).
- **`submissions`**: create/delete disabled entirely (`() => false`) — all player traffic goes
  through future runId-keyed endpoints (M3/M6); read/update/delete authenticated-only. No public
  read, verified below.
- Seed ran: 1 mode, 3 sections, 15 questions, 75 options in Postgres (checked via psql counts);
  re-run is a no-op ("already exists — admin edits are never overwritten").
- REST verification (anonymous): `GET /api/modes` → **200**; `GET /api/submissions` → **403**;
  `POST /api/submissions` → **403**.
- Admin UI: `/admin/collections/modes/1` renders all groups; section 01 shows key `archery`,
  name "AI Use-Case & Business Readiness", 3 band animations, 5 questions.
- `pnpm generate:types` ✓, `tsc --noEmit` exit 0 ✓, `pnpm lint` 0 errors ✓, `pnpm test:int` ✓.
- `pnpm test:e2e` still blocked on the Playwright chromium download (in progress at end of M2);
  scaffold frontend e2e will need rewriting in M3 anyway.

## M3 verification log (2026-10-13)

Files added: `src/app/(frontend)/[mode]/page.tsx` (force-dynamic, `notFound()` on unknown slug,
`React.cache`d loader shared with `generateMetadata`), `src/app/(frontend)/page.tsx` → redirect
`/default`, `src/game/GameShell.tsx` (client; machine instance, resume, server writes, focus per
scene), `src/game/components/Stage.tsx` + `Sprite.tsx`, scenes `Title/Intake/Question/SectionEnd/
Results.tsx`, `src/game/game.css`; `src/endpoints/runs.ts` wired into `Submissions.endpoints`;
`tests/int/machine.int.spec.ts` (13) + `tests/int/mode-resolver.int.spec.ts` (8); orphaned
scaffold `src/app/my-route/` deleted; template `styles.css` reduced to a base reset; layout
metadata now AI-Ready Knight.

- **Endpoint smoke tests (curl)**: create → 201 + uuid runId; answer → ack; replay of the same
  question id → count stays 1 and the value is replaced; GET snapshot → narrow projection with
  server-derived `sectionKey`/`score`; unknown run → 404; unknown mode → 404; empty name → 400;
  anonymous `GET /api/submissions` still **403**.
- **Real-browser playthrough** (after fixes below): title scene renders mode title/copy/chips →
  Begin training → intake (labels, disabled-until-valid submit, privacy note) → submit creates the
  run (POST 201) → first question with progress "Section 1 of 3 · Question 1 of 5" and 5 options
  whose accessible names are the option text (score badges are `aria-hidden`) → arrow keys move
  option focus → click answers (POST answer 200) → selected state → auto-advance after a 700 ms
  beat → Back returns to answered q1 (shows stored selection + Continue) → **reload mid-run
  re-attaches to the same run and lands back on the frontier question** → `/` redirects to
  `/default` → `/nonsense` renders the 404. No console errors.
- **Bugs found and fixed during verification**:
  1. `scale(min(100vw/1280, 100vh/720))` is invalid CSS — a length divided by a number is still a
     length, so `scale()` dropped the whole transform and the stage overflowed. Stage now measures
     the viewport in a client effect and stays `visibility: hidden` until measured (no flash, no
     hydration mismatch).
  2. `react-hooks/set-state-in-effect` (the eslint-config-next 16 rule set) flagged three sync
     setStates in effects — reduced-motion hook now lazy-initialises from `matchMedia`; the resume
     flow resolves through a promise; the auto-advance effect no longer clears its own stale id
     (the guard just never schedules for a mismatched id).
  3. Test-helper bug (not machine): `playThrough` skipped answers at section boundaries, and the
     results expectation missed the final section-end ADVANCE. Machine semantics confirmed correct.
- `pnpm lint` 0 errors ✓; `tsc --noEmit` exit 0 ✓; `pnpm test:int` **22 passed** ✓.
- **Known**: the browser-use automation's synthetic Enter does not activate a focused button (no
  answer POST fires) — not an app bug (mouse click path verified); real keyboard activation is
  covered by the Playwright e2e (`page.keyboard.press('Enter')`) which still awaits the chromium
  download. The e2e spec was rewritten for the game shell (redirect, intake → first question with
  keyboard answer + advance, /nonsense 404, portrait rotate-to-play).

## M4 verification log (2026-10-13)

Files added: `src/game/components/Knight.tsx` (pose slots + fallback), `Target.tsx` (real button,
accessible name = option text, idle/hover/hit poses, delayed impact overlay slot, stuck-projectile
slot), `SpeechBubble.tsx` (aria-hidden bubble + tail at `tailPercent`), `ProgressNav.tsx`
(`← Previous` · chip + "Question n of N · Section a of b" · next with section-aware label);
`docs/adr/0003-animation-technique.md`. Rewritten: `src/game/scenes/Question.tsx` (the M4 reference
implementation — stage-geometry constants, unified pointer/focus hover state keyed by questionId,
CSS-choreographed attack), `src/game/GameShell.tsx` (fixed-beat auto-advance → `actionFor` +
`onActionComplete`; QuestionScene keyed by question id so hover state resets per question), the
question block of `game.css` (M3 option-grid styles deleted).

- **Choreography** (ADR 0003): flight 380ms + impact hold 320ms = 700ms; arrow travels via CSS
  keyframes driven by inline `--ark-dx/-dy/-ang`; the target's impact overlay (hit pose + effect)
  uses `animation-delay: var(--ark-impact-delay)` set on the scene root, so the projectile lands and
  the target changes on the same beat. Completion is one always-resolving timer + any-key listener
  + full-board skip layer, ref-guarded to fire exactly once; reduced motion renders no arrow/skip
  layer and finishes synchronously. Game state (the answer) was already recorded before playback.
- **Live browser playthrough** (all 5 archery questions, default mode, placeholder art):
  - hover → speech bubble replaces the question band, tail points at the hovered target, hover pose
    + glow on the target, score badges 0→4 read left→right;
  - keyboard: focus starts on the heading, first ArrowRight lands on target 1, arrows wrap, focus
    beats a resting pointer for the bubble (newest interaction wins);
  - click → answer POST → attack (verified mid-flight via in-page probe: knight pose `attack`,
    arrow transform at ~61% of flight along the exact target angle, bubble locked to the chosen
    text, skip layer present; impact overlay opacity 0 until flight end);
  - skip: clicking the board during playback advances in **22ms** (vs 700ms full playback), same
    end state, answer unaffected;
  - back/replay: Previous → q2 shows `aria-pressed` on the stored option, hit pose + selection ring
    + stuck projectile placeholder, Next enabled;
  - refresh mid-run → resumes on the q3 frontier; after q5, refresh → frontier is section 2 q1
    (interstitial section-end scenes are not replayed — machine semantics from M3);
  - `GET /api/submissions/runs/:runId` after the run: 5 answers, server-derived scores
    (1/3/2/0/4), narrow projection only (no company name) — §6 intact.
- **Bugs found and fixed during verification**:
  1. Stuck projectile vanished on revisit when the mode has no projectile URL — the raw URL was
     checked before the placeholder fallback; now it goes through `assetOr` like the flying arrow.
  2. Arrow keys did nothing when focus sat outside the scene (e.g. after a stray click) — added a
     window-level fallback that hands focus to the row, deferring to the section handler.
  3. Pointer-over-focus precedence: a resting mouse cursor kept the bubble on its target while the
     keyboard moved focus elsewhere — `onFocus` now clears the pointer state.
- `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` 22 passed ✓ · `pnpm test:e2e`
  **8 passed** (incl. new reduced-motion test; spec updated for the nav order per §3.2) ✓.
- **Known**: the bundled Playwright chromium (rev 1208) still hasn't downloaded on this machine
  (CDN crawl, retried twice in the background). `playwright.config.ts` now takes
  `PW_CHANNEL=chrome|msedge` to run on a system browser; e2e above ran with `PW_CHANNEL=chrome`.
  Default stays `chromium` — on a machine with the bundle (or once the download lands) it works
  unchanged. The browser-use synthetic-Enter quirk from M3 still applies (mouse path verified
  live; real keyboard Enter is covered by the Playwright e2e).

## M5 verification log (2026-10-13)

Files added: `src/game/scoring.ts` (pure — `mean`, `sectionBandOf/sectionBand`, `finalBandOf/
finalBand`; the two band sets stay distinct; nothing is rounded before banding),
`tests/int/scoring.int.spec.ts` (every §4 boundary incl. unreachable fractional means).
Rewritten: `src/game/scenes/SectionEnd.tsx` (band → `sectionAnimation` entry; knight pose per band
celebrate/idle/fail; animation asset slot; caption; decorative frame aria-hidden), `GameShell`
passes `answers` down, section-end CSS (760px card + animation frame), e2e gained the section-end
band test.

- **Scoring pulled forward from M6**: M5's done-when ("all three section animations fire on the
  right band") needs the section band function, and §4 wants the module in one piece — so the
  whole `scoring.ts` (both band sets, all boundaries) lands now. M6 then owns the results screen,
  the final pose, the breakdown display and the shareable permalink (and any server-side use of
  scoring, e.g. caching scores onto the submission).
- **Live 15-question playthrough in one run** (placeholder art), bands chosen per section:
  section 1 all option 0 (mean 0) → section end shows archery `0-0.9` copy "arrow completely
  misses the target, the knight cries", knight pose **fail**, slot "Animation — 0-0.9";
  section 2 all option 2 (mean 2) → boxing `1-2.9` "knight punches bag, sweats profusely", pose
  idle; section 3 all option 3 (mean 3) → swordsmanship `3-4` "wooden sword is wielded with
  mastery, the dummy breaks and knight celebrates", pose **celebrate**. Last section's button is
  "See the final reckoning →". Run endpoint after the pass: `answerCount: 15, complete: true`.
- Sections 2/3 question scenes are the same component with section props (background label, chip,
  knight, targets all follow the section) — matches the boxing/sword wireframes (targets in a row,
  knight bottom-left); per-section differences are art, absorbed in M8.
- `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` **28 passed** ✓ · `pnpm test:e2e`
  **9 passed** (incl. the new band test) ✓.

## M6 verification log (2026-10-13)

Files added: `src/game/run-server.ts` (server-only narrow projection — `findRun`/`modeSlugOf`/
`snapshotOf`/`loadRunSnapshot`; the endpoints and the permalink route now share it so the two
surfaces can never diverge or leak more than `RunSnapshot`), `src/app/(frontend)/result/[runId]/
page.tsx` (the permalink), `docs/adr/0004-shareable-permalink.md`. Extended: `src/game/scoring.ts`
gained `scoreRun(sections, answers)` — per-section `{mean, band, answered, total}` + final
`{mean, band}`; only question ids the mode *currently* has count (a re-skin can never let a stale
answer skew a score); final mean is over every answered score, never a mean of section means.
Rewritten: `src/game/scenes/Results.tsx` (final knight via `results.finalKnight[band]`, overall
line, breakdown rows with band chips, live permalink + copy button, Train again). Touched:
`GameShell` (new `initialRunId` prop — resume tries `[?run= pointer, session pointer]`, first valid
run for the mode wins and is adopted as the session pointer; results case passes
`scoreRun(sections, state.answers)`), `[mode]/page.tsx` (`searchParams.run` → `initialRunId`),
`endpoints/runs.ts` (refactored onto `run-server.ts`; `getRunEndpoint` returns `loadRunSnapshot`
verbatim), `constants.ts` (`result` reserved so no mode can shadow the permalink namespace),
results block of `game.css`; tests: `scoring.int.spec.ts` +6, `frontend.e2e.spec.ts` +2.

- **e2e full playthrough + permalink reopen**: 15 questions under reduced motion with s1=option 5
  (4×5 → mean 4 → '3-4'), s2=middle option (2×5 → '1-2.9'), s3=first option (0×5 → '0-0.9') →
  results heading, "Overall score: 2.0 / 4 · Average", rows show 4.0/3-4, 2.0/1-2.9, 0.0/0-0.9.
  The permalink is then opened in **`browser.newContext()` — no storage, no session** — and shows
  the identical heading, overall and breakdown. (§3.4 done-when, both halves.)
- **e2e unfinished-run handoff**: `/result/<runId>` for a mid-run run answered through q3 → 307 to
  `/default?run=<runId>` → a fresh context resumes at "Question 4 of 5 · Section 1 of 3" purely
  from the URL (no sessionStorage in that context) — the `?run=` adoption path.
- **Live browser** (result permalink of the e2e run): card fits the 632px scene box with room to
  spare; `generateMetadata` title = "Sir Scoresalot's results — AI-Ready Knight"; heading
  auto-focused; **no console messages at all**; section names shown are the seed's long-form names
  ("AI Use-Case & Business Readiness", …). Copy button: e2e grants clipboard permission and asserts
  the button flips to "Copied" **and the clipboard now holds the absolute permalink URL**; the
  no-permission path was also exercised live — it shows "Copy failed" and selects the URL text for
  manual Ctrl+C instead of failing silently. One e2e failure found + fixed: the first selectors
  used section *keys* (Archery/Boxing) but the cards render section *names* — test-side fix, app
  was correct.
- **Scoring contract** re-verified: `scoreRun` boundary tests (2.8 stays '1-2.9'; 2.87 overall
  stays average; 2.93 promotes; empty run 0; partial run scores only what was answered; a stale
  question id counts for nothing) — 34 int tests total.
- ADR 0004 records the permalink contract: route shape, narrow projection, unfinished-run redirect,
  unknown runId → 404, one shared `ResultsScene` for in-game and permalink.
- `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` **34 passed** ✓ · `pnpm test:e2e`
  **11 passed** ✓ (PW_CHANNEL=chrome per the M4 known issue; chromium-1208 download still pending).

## M7 verification log (2026-10-13)

Files added: `src/game/report.ts` (pure — `validateReport` schema gate: clamps 3 strengths / 3 gaps
/ 5 next steps, empty strengths allowed, text caps, drops unknown fields; `fallbackReport` with
deterministic per-final-band copy, weakest-section names injected, gaps weakest-first),
`src/game/report-server.ts` (server-only — `qwenConfig` env reader, `reportInputs` one scoring pass
feeding prompt + fallback + the cached `scores` field, `buildSystemMessage`/`buildUserMessage`,
`extractJsonObject` fence-strip + first-`{`-to-last-`}`, `parseReportContent`, `requestQwenReport`
with `AbortSignal.timeout(25s)` + retry-once on 429/5xx/network/timeout, injectable `fetchImpl`,
`storedReportOf` re-validating stored JSON, in-flight map, `generateReportForRun` cache-first),
`src/game/scenes/ReportPanel.tsx` (presentational report view), `tests/int/report.int.spec.ts`
(37 tests). Extended: `endpoints/runs.ts` (`reportEndpoint` — 400 for missing runId/incomplete run,
404 unknown, then generate + narrow `{runId, status, report}`), `Submissions.ts` (endpoint
registered), `run-server.ts` (`snapshotOf` now carries `report`), `types.ts` (`RunSnapshot.report`,
`ReportAck`), `run-client.ts` (`requestReport`), `Results.tsx` (view toggle, auto-generation on
results mount with a `startedRef` guard so StrictMode's double-mount cannot discard the single
fetch, report status line + retry), `GameShell.tsx` (`RunMeta.report` → `initialReport`),
`result/[runId]/page.tsx` (same), results/report block of `game.css`, `frontend.e2e.spec.ts`
(full-playthrough test now opens the report, asserts provenance + ≥3 steps + exactly one
`POST /report`, and proves the fresh-context permalink reuses the cached report with **zero**
further POSTs).

- **Hybrid-reasoning discovery (important for whoever swaps models)**: the hosted `qwen3.8-flash`
  is a thinking model — with thinking on, a report-sized prompt burned ~900 hidden reasoning tokens
  and took 23s (right at the 25s timeout; under the app's fuller system prompt it timed out twice →
  fallback in 51s). With `enable_thinking:false` the same request lands in 8s. The knob is
  **env-driven** (`QWEN_DISABLE_THINKING=true` in `.env`, parsed by `qwenConfig`) so no
  vendor-specific parameter is baked into source; drop the line for a plain OpenAI-compatible
  server. .env was edited (gitignored — never committed).
- **Live path (hosted endpoint up), real browser**: full 15-question playthrough in the browser →
  "Your QWEN-written report is ready." · report opens with provenance "Written by QWEN from your
  answers." — tailored content verified: strengths cite the actually-strong answer pattern, gaps
  mirror the weak section (even quoting "the 0.0 score in governance"), next steps reach into
  shop-floor/manufacturing specifics. Generation via the app endpoint measured **6.5–8.6s**; a
  legacy M5-era run viewed in the browser generated its report on first view too.
- **Fallback path (endpoint dead), real browser + curl**: with `QWEN_BASE_URL` pointed at a dead
  port the same flows produce "Your report is ready — written from your scores, the AI scribe was
  offline." in ~1s; template report reads as a real report (company-named headline, band-specific
  summary + steps, weakest sections named). Server log shows exactly one
  `[report] QWEN unavailable — using the template report (network-error)` — the reason only, no
  answers, no company name.
- **Caching (refresh must never re-bill)**: second `POST /report` on a cached run returned in 89ms
  and logged no second warning; the e2e proves it at the network layer — one generation in the
  playthrough context, `0` in the fresh permalink context; the permalink status line shows
  "ready" immediately from the stored snapshot.
- **Gates**: incomplete run → 400 "The report can only be written for a completed run" (10ms, no
  QWEN call); unknown runId → 404 (9ms). Combined with the unguessable runId + once-per-run cache,
  the endpoint is not a free text-generation API.
- **Secret hygiene**: `NEXT_PUBLIC` appears nowhere in `src/`; production build (`pnpm build` ✓)
  then grepped — the key value, `sk-ws-` prefix, the API host and `QWEN_API_KEY` all absent from
  `.next/static` (client bundles) and the key value absent from `.next/server` too (runtime env
  read, never inlined).
- **Test-state discipline**: e2e runs with the endpoint dead (`QWEN_BASE_URL=http://127.0.0.1:9/v1
  pnpm dev` — process env wins over `.env` for @next/env; the int suite never touches the network,
  stubs + a dead port only). A live-endpoint e2e run would bill real calls; don't.
- `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` **71 passed** ✓ (37 new) ·
  `pnpm test:e2e` **11 passed** ✓ on the frozen code.

## Plan (approved 2026-10-13; historical — see Decisions)

### Approach — the decisions that shape everything

**Rendering: DOM + CSS on a fixed 1280×720 stage** (canvas rejected). Reasons: the accessibility
baseline requires real focusable controls (`<button>` per target, "speech bubble is not the only
way to read an option") — canvas would force a parallel ARIA layer for every element; every sprite
is a CMS upload, which maps directly to `<img src>`; the whole stage is scaled to fit via one CSS
`transform: scale()`, so sprite alignment survives any viewport. Animation complexity here (sprite
swaps, one projectile travel, recoil) is low; canvas buys nothing. → ADR in M3.

**Animation: sprite-frame swaps + CSS transitions**, all playback guarded by a `Promise` that races
a timeout, so a dropped frame or backgrounded tab can never strand the player (skill failure mode
#3). `prefers-reduced-motion` collapses every animation to an instant state change.

**State: one pure scene machine** (`src/game/machine.ts`) + run state in `sessionStorage` (runId
only) mirrored server-side. Answers are written server-side per answer, keyed by runId, replace-on
-replay (`Record<questionId, Answer>`, never append). Refresh mid-run re-attaches via sessionStorage.

**Routing:** `src/app/(frontend)/[mode]/page.tsx` loads the mode server-side; unknown slug →
`notFound()`. The `(payload)` route group owns `/admin` and `/api` — verifying `[mode]` cannot
shadow them is an explicit M3 acceptance check.

**Fallback resolution:** one server-side resolver loads `mode` + `default` and deep-merges every
empty slot (assets and text) onto `default`, then to dev placeholder descriptors. Components never
branch on null. `default` must be complete before other modes are useful — it is the fallback source.

**Player-facing writes go through dedicated Payload custom endpoints** keyed by the unguessable
`runId` (create run, answer, generate report, fetch results). The `submissions` collection itself is
closed: no public read ever; public REST create/update disabled so nothing can set `scores` or
`report` from outside. The results endpoint returns a narrow projection (knight pose, scores, band,
report) — never the raw document.

**QWEN:** server-side only, env-driven (`QWEN_BASE_URL` / `QWEN_API_KEY` / `QWEN_MODEL`), OpenAI
-compatible chat completions; deterministic template fallback built first and used on any failure
(missing key, network, non-2xx, timeout, malformed/validation failure); report cached on the
submission keyed by runId so a refresh never re-bills; system prompt/tone CMS-editable per mode.

### Data model sketch

```
modes (collection)
├── slug            unique, indexed, url-safe; reject 'admin' | 'api' | '_next'
├── title
├── theme           accent colour, fonts, bubble/button skin
├── titleScreen     background, logo, copy
├── sections[3]     minRows: 3, maxRows: 3 + validate keys {archery, boxing, swordsmanship} distinct
│   ├── key, name, description, icon
│   ├── assets      background · knight.{idle,attack,celebrate,fail} · target.{idle,hover,hit}
│   │               · projectile · hitEffect            (all upload → media)
│   ├── sectionAnimation[3]  band keys '0-0.9' | '1-2.9' | '3-4'  (text + asset) — verbatim
│   └── questions[5]
│       ├── id      stable, generated at seed, never regenerated
│       ├── text
│       └── options[5]  { text, score } — validate exactly 5, scores 0..4 ascending
├── results         background · finalKnight.{low_average, average, high_average}
└── ai              systemPrompt, tone

submissions (collection) — confidential; admin read only, no public read
├── runId           nanoid/uuid, unique, indexed      ← the access token for result links
├── mode            relationship -> modes
├── knightName, companyName, industry
├── answers[]       { questionId, sectionKey, optionIndex, score } — one per question id
├── scores          per-section {mean, band} + final {mean, band}   (computed server-side via scoring.ts)
├── report          { status: pending|ready|fallback, data, generatedAt } — cached
└── timestamps
```

Scoring lives only in `src/game/scoring.ts` (pure, unit-tested, both band sets, exact §4 thresholds,
no rounding before banding). Imported by results screen, section-end scene and QWEN prompt builder.

### Milestones

Exactly the M1–M10 list from `QODER.md` §8; tracked as tasks in the current session. Order:
M1 plan → approval → M2 backend → M3 shell → M4 archery (reference) → M5 boxing/sword → M6 scoring
/results → M7 QWEN → M8 art (sample check first) → M9 electric re-skin → M10 hardening.

## Ground truth verified (2026-10-13)

- Node v24.16.0, pnpm 12.9.1 (package.json engines say pnpm ^9||^10||^11 — warning only, works).
- Local PostgreSQL 18.4 on 127.0.0.1:5432, database `ai_ready_knight` exists and `DATABASE_URL`
  from `.env` connects (verified with psql).
- `.env` is gitignored ✓ (contains real values — never commit).
- `docker-compose.yml` is the stale mongo scaffold with postgres commented out — **not used**; repo
  runs against the local Postgres. Clean up during M10.
- `ai_readiness_questions.json` read: 3 sections (usecase/archery, talent/boxing, execution
  /swordsmanship), 5 questions × 5 options each, scores 0–4, section_animation keys `0-0.9`,
  `1-2.9`, `3-4`, summary_pose bands high_average/average/low_average.
- Wireframes viewed (archery set): 5 targets top row evenly spaced; hover → wide speech bubble with
  tail pointing at hovered target; click → arrow sticks into chosen target, bubble persists during
  the action.
- Scaffold state confirmed: `payload.config.ts` = Postgres adapter + Lexical + Users/Media only;
  `(payload)` routes untouched; frontend placeholder page to be replaced; `src/app/my-route/` is
  unused scaffold (remove during M3).

## ⚠ Flagged conflict — QWEN endpoint (resolved: pending user answer)

`QODER.md` §5/§10 say: "No hosted credentials yet… default to a localhost endpoint… the endpoint
will usually not be running during development." That no longer matches reality: `.env` now
contains **working hosted Aliyun DashScope credentials** (`QWEN_API_KEY` +
`QWEN_OPEN_AI_ENDPOINT=https://…aliyuncs.com/compatible-mode/v1`), and a read-only `/models` probe
returned HTTP 200 with available models (qwen3.8-flash, qwen3.8-max-0902, glm-5.3, deepseek-v4.1
-flash, …). This matches `Qoder.txt`: "for the AI tools, we are going to use QWEN, i will supply
all the details in the .env file" — and `Qoder.txt` wins on conflict.

Proposed resolution (asked 2026-10-13):
- Keep the code fully env-driven and vendor-free (`QWEN_BASE_URL`, `QWEN_API_KEY`, `QWEN_MODEL`).
- Keep `.env.example` defaulted to localhost (per `QODER.md`), but wire the real `.env` to the
  hosted compatible-mode endpoint so the live path is testable, and pick a model (env-switchable).
- Build the deterministic fallback **first** and keep it as the always-available degradation path —
  required for resilience regardless of where the endpoint lives.

## Decisions taken (2026-10-13)

- **Plan approved by user** — start M2 with the plan above unchanged.
- **QWEN conflict resolved**: use the hosted endpoint already in `.env` (env-driven code, vendor-free
  source), keep the deterministic fallback as the always-available path. `.env` gained
  `QWEN_BASE_URL` (existing compatible-mode URL) and `QWEN_MODEL=qwen3.8-flash` (chosen by user;
  env-switchable to `qwen3.8-max-0902`, `glm-5.3`, …). `.env.example` keeps localhost defaults per
  QODER.md.
- Rendering/state/persistence/fallback/scoring/QWEN approaches per the plan section.

## Open questions (resolved 2026-10-13)

1. QWEN wiring — resolved: hosted endpoint now (above).
2. Plan approval — resolved: approved; M2 started.
