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
| M8 | Default art set | **complete** | full set generated, processed (`art/default/**`, 40 files), wired (`pnpm art:wire`, all 43 slots resolve), verified in-game — see the completion log below |
| M9 | Re-skin proof (`electric`) | **complete** | `electric` shipped through the real `/admin` UI (duplicate → rename → partial upload → save), per-slot fallback proven by scripted playthroughs with one *and* three assets; operator guide is `docs/modes.md` (see log below) |
| M10 | Hardening | **complete** | README rewritten for a new developer; docker-compose is postgres-only; favicon added (no more console 404); a11y pass (keyboard-only full playthrough e2e + recovery-screen focus); error-state e2e (answer failure, resume failure, unknown `/result` 404); all gates green — `pnpm test` 74 int + 15 e2e (see log below) |
| M11 | Electric art set | **complete** | full set generated (sample gated first, as in M8), processed with `process-set.mjs electric` (`art/electric/**`, 40 files / 43 slots, knight cap K=540), wired via slug-aware `pnpm art:wire electric`; `/electric` verified end to end with **zero** `default` URLs and zero placeholders; questions byte-identical to `default`; per-slot fallback re-proven on a throwaway scratch mode; all gates green — lint/tsc 0, 74 int + 15 e2e (see log below) |
| M12 | Grounded targets + `default16` | **not started** | Added to `QODER.md` §8 on 2026-10-14 (settled decisions #8, #9). (a) archery targets float above the ground plane in `/default` and `/electric` — **diagnose geometry vs art before regenerating** (`TARGET_TOP = 198` + `TARGET_SIZE = 200` → box bottom at stage Y 398; measure the sprites' alpha bboxes and the backgrounds' ground Y first); (b) record the measured baseline in the `game-assets` skill so it cannot recur; (c) full 16-bit pixel-art set on slug `default16`, sample gate first, `pnpm art:wire default16`. Watch `sharp`'s default resize kernel — it will blur pixel art. |

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

## M8 sample log (2026-10-13) — user-approved, completion log below

Per the game-assets skill, the sample is the style anchor (knight) plus one section, reviewed
before the full pass. Generated with the ImageGen tool (one prompt per asset, style + character
anchors used verbatim — full prompts in `docs/art-prompts.md`), raws kept in `vibe_images/` and
copied into `docs/art-sample/raw/`.

- **Raw generations**: `knight-sheet-sample` 1536×1024 (two poses: idle | attack, split after
  generation so face/outfit/palette cannot drift), `target-idle-sample` 768×1024,
  `background-sample` 1792×1024, `arrow-sample` 1024×768. Judged a coherent set on review.
- **Processing** (`scripts/art/process-sample.mjs`, sharp — no Python): border-connected white-key
  flood fill → fringe erosion → enclosed-pocket clearing (knight) → warm-tint smear removal
  (arrow) → alpha-bbox trim → one shared scale for the pose pair (0.532) → bottom-centre anchor on
  the game's actual @2x render boxes (knight 600×520, target 400×400, arrow 240×68, background
  2560×1440 upscaled from the raw).
- **Two keying defects found in self-review and fixed with measured thresholds** (probe script,
  then deleted — numbers live in the code comments):
  1. *Enclosed backdrop pockets* — the bow loop and string triangle never touch the image border,
     so the flood fill cannot reach them; they rendered as opaque white holes. Fixed by
     component-scanning enclosed near-white regions and clearing area ≥ 100 px (real pockets
     149–39 370 px; art whites — eye highlights, feather cells — ≤ 50 px, so nothing of hers was
     punched out). Bow holes now show the yard through, eye highlights intact.
  2. *Warm cream speed-smoke on the arrow* — per-channel white-keying misses it (its blue channel
     is low). Measured: the smoke is warm (r − b +5…+8, mean 227–232) while every feather white is
     cool (r − b −7…−10). Fixed with a tint-based erosion pass (r − b ≥ +4, mean ≥ 215). Game
     animates flight itself; the thin drawn motion streaks near the fletching were kept.
- **Preview composite** `docs/art-sample/preview-composite.png`: 1280×720 mock built at the real
  in-game coordinates (targets at x = 70 + i·235 / top 198, knight box at 300,430, arrow
  mid-flight) — the sample reads exactly like the concept wireframes (target row on the band,
  knight bottom-left, arrow flying to the clicked target).
- **Deliverable for review**: `docs/art-sample/` — the four sprites, the background and the
  composite. Nothing is wired into the CMS yet; the full set (celebrate/fail poses, target hit
  states, hit effect, boxing/swordsmanship, section-end beats, title/results) waits for the user's
  go-ahead.

## M8 completion log (2026-10-13)

Files: `art/default/**` (40 processed outputs: title background+logo, results background+3 finals,
per section background + 4 knight poses + 2 target states + hit effect + 3 band beats, archery
projectile), `scripts/art/process-set.mjs` (the full-set pipeline; supersedes `process-sample.mjs`,
deleted with the probe scripts now that the measured thresholds live in its comments),
`src/seed/wire-art.ts` + `pnpm art:wire` (CMS wiring), `scripts/art/verify-in-game.mjs` (the
scripted in-game verification, kept for M9/M10), `docs/art-prompts.md` (fully synced).

- **Generation** followed the approved sample anchors verbatim; 6 two-pose knight sheets (12 poses
  across the sections — sheet-splitting is what keeps her face/outfit consistent per section),
  targets as idle+hit pairs (hover is CSS glow on the idle sprite — no separate asset), one hit
  effect per section, three 720×340 band beats per section, three finalKnight builds, logo, three
  backgrounds.
- **Processing** (`process-set.mjs`, sharp, no Python): **adaptive per-file white-key** — key limit
  per channel measured from the file's border ring, `clamp(median − 7, 236, 248)`; a fixed 245 left
  several raws partly opaque (warm paper) while fixed-low thresholds ate art whites. Fringe 224,
  hole-clearing 242/≥100 px/rim 240, warm-smear (r − b) for the arrow only. **One global knight
  scale** — `K = min(fitFactor × rawHeight)` over all 12 poses = 545 raw px, so she is the same size
  in every section (the archery sheet's 0.532 factor reproduces the approved sample layout
  pixel-exactly). Target idle/hit share one pair-min fit so the hit moves within the idle
  footprint. Beats 720×340 margin 6, finals 264×264 bottom-anchored margin 4, logo 680×240 margin 4.
- **Review caught two background collisions**: the first boxing/sword backgrounds had props baked
  into the play row (a dummy beside where sword slot 2 lands, a flat bag beside boxing slot 2), so
  the CMS sprites doubled them. Regenerated as **v2** with the bare-middle-band constraint stated
  explicitly (now recorded in `docs/art-prompts.md`); review frames re-rendered at true game
  coordinates are clean. Superseded v1 raws stay on disk, uncommitted.
- **Wiring** (`pnpm art:wire`): 40 media uploads (find-or-create by unique staged filename; re-runs
  need `REPLACE=1`), the default mode's sections rebuilt with row ids preserved, `target.hover`
  bound to the idle media id, projectile wired for archery only, beats bound per band key. The
  script's own verification pass re-reads the mode and reports all **43 slots** resolving to real
  `/api/media/file/...` URLs. Placeholders are no longer reachable in `/default`.
- **In-game verification** (`scripts/art/verify-in-game.mjs`, Playwright on system Chrome —
  bundled chromium-1208 is an incomplete download, `PW_CHANNEL=chrome` as in M4): a full scripted
  run against a **dead-QWEN dev server** (`http://127.0.0.1:9/v1`). Answer plan 1.8 / 0.6 / 3.6 →
  every section band exercised (1-2.9 idle · 0-0.9 fail · 3-4 celebrate), overall 2.0 → average.
  Asserts per scene: zero `.ark-placeholder`, all images complete, pose/beat/copy per band, melee
  sections render no `.ark-arrow` element, fallback report arrives with the provenance line
  ("the AI scribe was offline"). 18 screenshots in `docs/art-sample/verify-*.png`.
- **Three real defects the verification caught and fixed**:
  1. *Melee placeholder projectile* — the question scene rendered the flying arrow and the
     stuck-arrow overlay unconditionally, so boxing/swordsmanship attacks showed a "Projectile"
     placeholder for a slot the design keeps empty. Now guarded on `section.assets.projectile`
     (reduced-motion e2e unaffected — it renders no arrow at all).
  2. *`results.background` wired but never rendered* — the M6 results scene had no scene
     background, so the slot the skill list requires was dead. `Results.tsx` now renders it in
     both views (scores + report), with `position: relative` added to both cards (the same
     stacking treatment the title card already had).
  3. *Readability over the real backgrounds* — the question banner, the progress line and the gold
     section chip were designed against the dark placeholder backdrop; on sky/wall/lawn they lost
     contrast. Soft scrim text-shadows on banner + progress, dark plate on the chip (same language
     as the score badges).
- **Gates**: `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` **71 passed** ✓ ·
  `pnpm test:e2e` **11 passed** ✓ (dead endpoint; one full-suite run flaked on a dev-server
  compile — re-run after the warm-up, green twice) · verify-in-game **PASSED** ✓.

## M9 completion log (2026-10-13)

Files: `docs/modes.md` (new — the operator guide, the milestone's deliverable), `docs/art-prompts.md`
(electric appendix with the verbatim prompts), `scripts/re-skin-proof.mjs` (new — the whole admin
flow, Playwright), `scripts/art/verify-electric.mjs` (new — scripted playthrough with per-URL
assertions), `scripts/art/process-electric.mjs` + `vibe_images/` raws + `art/electric/archery/**`
(3 sprites), `docs/modes-proof/**` (24 screenshots: admin trail 01–09 + verify-partial/full runs).
Code changes needed to make admin duplication actually work (all in `src/collections/Modes.ts`
plus consumers): question subfield `id` → `key` (+ SQL migration on `modes_sections_questions`),
`slug.beforeDuplicate` hook, `disableDuplicate: true` on every art upload slot; regenerated
`src/payload-types.ts`; new regression net `tests/int/duplicate.int.spec.ts`.

- **Why the code changes** (each was a real duplication blocker found by drilling into Payload's
  duplicate source):
  1. A questions subfield literally named `id` becomes the array row's **primary key**
     (`modes_sections_questions.id`) and Payload skips its baseIDField — duplication collided on
     `archery-q1`. Renamed to `key` (label "Question key"): row ids now regenerate per copy, keys
     carry over, stored answers stay keyed. Migration: add column → copy `key = id` → set not-null.
  2. The admin Duplicate button sends **no data**, so the copy carried the source slug into the
     unique index (400 "Value must be unique"). Added a field hook on `slug` (`beforeDuplicate`):
     `${slug}-copy`, then `-2`…`-99` walking for a free slug. API duplication with explicit data is
     unaffected (incoming data overrides the hook — verified against Payload's source).
  3. `disableDuplicate: true` on the art factory: a duplicated mode now starts as an **empty art
     shell** (every slot falls back to `default`) instead of cloning media pointers — the re-skin
     premise, and the thing `verify-electric.mjs` asserts.
- **The partial set**: two ImageGen raws (prompts recorded verbatim in `docs/art-prompts.md`),
  `process-electric.mjs` (same pixel pipeline/constants as the M8 set) → `target.idle@2x.png`,
  `target.hit@2x.png`, `hitEffect@2x.png` in `art/electric/archery/`.
- **The admin proof** (`node scripts/re-skin-proof.mjs phase1|phase2|clean`, real `/admin`, system
  Chrome): duplicate `default` (id 1) → slug becomes `default-copy` via the hook → rename to
  Electric / `electric` / accent `#4dd8ff` → save → "Show All" sections → upload targets through
  the Create New drawer → save. Evidence: `docs/modes-proof/01`–`09`. A first live run is worth
  remembering: it duplicated the **wrong row** (the mode list sorts by recency, and clicking "the
  first row" hit Electric, colliding on the unique slug) *and* the save-wait false-positived on a
  case-insensitive toast substring while a 400 was showing. The script now targets the row by its
  `td.cell-slug` text, races success vs **error** toasts (throws on error), and re-asserts the slug
  after every save. (The DB was cleaned back to `default`-only before the green rerun.)
- **The verification** (`node scripts/art/verify-electric.mjs [partial|full]`, dead-QWEN dev
  server, same answer plan as M8 so bands/results are directly comparable): every scene asserts the
  resolved media URL behind each `<img>`. `partial` (1 uploaded asset) — 77/77: electric target
  idle renders and the default archery target idle is shadowed; background, knight, projectile,
  target hit, hit effect, band beats, title, results **all carry default URLs**; boxing /
  swordsmanship / title / results contain **zero** electric URLs; accent `#4dd8ff` is on the
  stage; title/intake/results copy reads "Electric"; full 15-question walk, three bands, average
  results, offline report. `full` (3 assets, after phase 2) — flips the hit/effect assertions to
  the electric uploads, defaults shadowed. If a page renders nothing, the script dumps the full
  src list per scene. Screenshots `docs/modes-proof/verify-partial-*`, `verify-full-*`.
- **`docs/modes.md`** — the non-technical 10-minute path (duplicate → rename → save → upload →
  save → play), the per-slot fallback explained with the electric run's hover screenshot (unfilled
  hover slot visibly shows the default golden target), replace/clear/delete/rename notes, gotchas
  (unique-slug error, do-not-edit-`default`), and the replay commands.
- **Gates**: `pnpm lint` 0 errors ✓ · `tsc --noEmit` ✓ · `pnpm test:int` **74 passed** ✓ (6 files;
  includes the new cross-mode key-reuse regression) · `pnpm test:e2e` **11 passed** ✓ (dead
  endpoint) · verify-electric **partial + full PASSED** ✓.
- Known cosmetic (deferred to M10): the template app 404s `/favicon.ico` (one informational
  console line during verification).

## M10 completion log (2026-10-13)

**README** — full rewrite ([`README.md`](README.md)): what the game is, prerequisites (Node ≥
20.18.1, pnpm 9/10/11, Postgres, optional OpenAI-compatible endpoint), quick start (`cp
.env.example .env` → `pnpm install` → `pnpm seed` → `pnpm dev`, first `/admin` visit creates the
first user), how a run flows, the mode system pointing at `docs/modes.md`, the art pipeline
(`docs/art-prompts.md`, `scripts/art/`, `pnpm art:wire`), the QWEN env contract incl.
`QWEN_DISABLE_THINKING` (also added to `.env.example`, commented), and the test notes that matter:
`pnpm test:int` uses the `.env` DB; **e2e reuses a running :3000 server, so point it at a dead
endpoint first** (`QWEN_BASE_URL=http://127.0.0.1:9/v1 pnpm dev`); `PW_CHANNEL=chrome` when the
bundled Chromium is unavailable. `package.json` description updated off the template placeholder.

**Housekeeping** —
- `docker-compose.yml` rewritten from the stale mongo+payload scaffold to a **postgres-only
  optional dev DB** (`postgres:17-alpine`, user/db `payload`/`ai_ready_knight`, healthcheck),
  matching `.env.example`/README. Docker is not installed on this machine, so it is
  **YAML-syntax-validated only** (parsed with js-yaml; fields inspected) — never `up`-tested.
- **Favicon**: `src/app/(frontend)/icon.svg` — an archery-target-and-arrow mark in the game palette
  (three candidate designs rendered at 16/32/128 on light and dark, picked the crispest). Next
  serves it as a hashed URL and injects `<link rel="icon">` (verified: `/icon-4usi79.svg…` → 200
  `image/svg+xml`); a real-Chrome probe of `/default` now shows **no failed requests and no console
  errors** — the favicon 404 from M9 is gone (the raw `/favicon.ico` path still 404s by design, but
  nothing requests it once the link is declared).

**Accessibility pass** (behavioral, no new dependency — axe rejected on purpose: the game's a11y
contract is *drivability* — real `<button>` targets, roving focus, scene-heading focus, live
regions — and the suite exercises all of it; a static-tree rule scanner would add a dependency and
flag false positives against the decorative stage without proving anything the tests below don't) —
- New e2e: **keyboard-only full playthrough** — Tab/arrows/Enter only, no mouse: title → intake
  (typed) → 15 questions (first arrow lands the row, Enter answers) → both section beats → results
  → report opens; asserts focus lands on each new scene heading and on every control before Enter.
- Fixed in `GameShell.tsx`: the recovery screen was reachable by keyboard but focus never moved to
  it (the focus effect bailed unless `phase === 'ready'`). The guard is gone; the effect is now a
  no-op while nothing focusable exists. The new resume-failure test asserts the recovery heading is
  focused.

**Error states** — three new e2e tests:
- *Answer save fails*: POST `/answer` answered with a 500+`{error}` → the banner (`role="alert"`)
  shows the server's message, the machine stays on the question, nothing is marked chosen; after
  `unroute`, the same click goes through and Q2 arrives.
- *Resume with the server down*: `?run=` + GET 500 → "Your session could not be restored" with the
  message, both recovery actions present; after `unroute`, **Try again** resolves to the title.
- *Unknown `/result/<runId>`*: 404 status, no game stage rendered.
- (Portrait rotate-to-play and the offline-report fallback were already covered by the M4/M7-era
  tests; both still pass unchanged.)

**Two test-vs-reality findings during the run** (kept here for future sessions): Next's router
announcer div is also `role="alert"`, so the banner assertion filters by content; and under reduced
motion the `aria-pressed` window on a retried answer is ~one frame, so the retry asserts the
observable contract (advance + alert cleared) instead.

**Gates** (all against the **dead endpoint** server, `QWEN_BASE_URL=http://127.0.0.1:9/v1 pnpm
dev`, so no billed call): `pnpm lint` **0 errors** ✓ · `pnpm exec tsc --noEmit` **0** ✓ ·
`pnpm test:int` **74 passed** (6 files) ✓ · `pnpm test:e2e` **15 passed** (12 frontend + 3 admin;
11 pre-existing + 4 new) ✓ · `pnpm test` chain **exit 0** ✓ · manual open: title + Q1 rendered
correctly in real Chrome (screenshots checked), `/admin` 200 ✓.


## M11 completion log (2026-10-13)

**Sample gate first, as in M8** — the knight plus the archery section were generated as an
electronic/cyberpunk re-skin of the same compositions and reviewed against the `default` originals
side by side (`docs/art-sample/compare-electric-archery.png`, `review-electric-archery[-poses].png`);
user-approved, then the remaining ~37 raws were made in one consistent style pass. Per-section
review sheets: `review-electric-boxing[-poses].png`, `review-electric-swordsmanship[-poses].png`,
`review-electric-title-results.png`.

**Full set** — raws in `vibe_images/` (superseded drafts kept; the regeneration history — archery
background v2 no-people clause, sword-sheet midline drafts, grey-paper/drop-shadow regens, logo v1
shadow — is in the art-prompts appendix). Processed with `node scripts/art/process-set.mjs
electric`: same pipeline, render boxes and global-scale discipline as `default`; the knight
constant is **capped at the default set's and lands at K=540**, so the two sets are swappable
pixel-for-pixel. 40 files over 43 slots in `art/electric/**` (target idle/hit pair shares one fit
factor, beats 720×340, finals bottom-anchored, backgrounds 2560×1440). The M9 partial pass's
`process-electric.mjs` was retired (same precedent as `process-sample.mjs` in M8).

**`art:wire` generalized** — `src/seed/wire-art.ts` now takes a mode slug: `pnpm art:wire [slug]`,
default stays `default` so the old usage is unchanged. Non-default uploads are namespaced
`<slug>-<dir>-<file>` (e.g. `electric-archery-knight.idle@2x.png`) so electric media can never
collide with — or accidentally satisfy an assertion about — a default URL; alt text prefix
`Default — ` → `Electric — `; `target.hover` reuses the idle upload as before. `pnpm art:wire
electric` wired all 43 slots. The three M9-era hand-uploaded media docs (ids 44–46) were deleted as
orphans — media is now **80 docs: 40 `default` + 40 `electric`**.

**Verification inverted** — `scripts/art/verify-electric.mjs` used to assert that most slots *do*
resolve to `default` URLs; it now proves the opposite. Full 15-question `/electric` playthrough
(PLAN scores → bands 1-2.9 / 0-0.9 / 3-4): every slot in every scene asserts an **electric** URL,
**zero** `default` URLs are reachable (all `<img>` srcs and CSS `background-image` URLs are
normalized and checked against the 40-member default set — the `electric-` prefix makes the check
collision-proof), zero placeholders, questions **byte-identical** to `default`, the dead-QWEN
fallback report renders, accent `#4dd8ff` and the `Electric` kicker are live. All green;
screenshots `docs/modes-proof/verify-m11-*.png`.

**Fallback re-proof — choice: throwaway scratch mode.** M9's per-slot fallback evidence was *that
electric was partial*; a complete electric retires it. We chose the **throwaway-scratch route over
keeping one named slot deliberately empty**, so the shipped `electric` mode carries no permanent
holes. `scripts/art/verify-fallback-scratch.ts` (`pnpm art:verify-fallback`): duplicate `default`
via the local API (`disableDuplicate` keeps the art out), upload exactly **one** electric asset
into the copy, play a full run asserting the mix (electric target at the archery questions, default
everywhere else, the default target idle shadowed at Q1), then delete the scratch mode **and its
submissions** — even if the run failed. All green; screenshots `verify-scratch-*.png`. The route is
stated in `docs/modes.md` (Part 2) and here, per the M11 contract.

**Docs** — `docs/modes.md` (scratch-route paragraph, `art:wire <slug>` step, media-naming gotcha,
updated command list incl. the re-skin-proof warning), `README.md` (both sets complete;
`process-set.mjs <set>`; `pnpm art:wire <slug>`; the two verification scripts), `docs/art-prompts.md`
— the full **electric appendix**: both extra anchors (palette, knight), the regeneration history,
and every final prompt verbatim keyed by slot; the M9 section was annotated where M11 superseded it
(script retired; idle/hit re-placed by the reprocess).

**Gates** (all against the **dead endpoint** server, `QWEN_BASE_URL=http://127.0.0.1:9/v1 pnpm
dev`, so no billed call): `pnpm lint` **0** ✓ · `pnpm exec tsc --noEmit` **0** ✓ · `pnpm test:int`
**74 passed** (6 files) ✓ · `pnpm test:e2e` **15 passed** with `PW_CHANNEL=chrome` ✓. Done-when
re-checked: `/electric` plays end to end on electric art with zero `default` URLs and zero
placeholders reachable, `/default` is unchanged (default e2e playthrough + byte-identity check),
per-slot fallback is proven on the scratch mode, and questions were not touched.


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
