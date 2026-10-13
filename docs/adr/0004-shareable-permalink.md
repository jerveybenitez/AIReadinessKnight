# ADR 0004 — The shareable permalink: URL shape, projection and unfinished-run handoff

Status: accepted (M6)

## Context

§3.4 requires a shareable, permanent, non-expiring permalink per run, and §6 makes the link
itself the access token: "the permalink exposes only what a recipient should see — the knight,
the scores and the report. Return a narrow projection, not the whole submission document."

That means the permalink URL is a public, effectively irreversible contract: once a link is
handed to a colleague it must keep working, in any browser, forever. The route shape and the
data it can ever expose therefore deserve an explicit decision now.

## Options

1. **Hash route inside the game page** (`/default#/results?run=<id>`, the M3 stub's placeholder).
   Rejected: the hash never reaches the server, so the result page cannot be server-rendered,
   cannot set its own metadata title, and the run cannot be validated or redirected server-side.
   A recipient without the game bundle would get a blank title and a client-only flash.
2. **Query on the mode URL** (`/default?results=<id>`). Rejected: mixes two meanings in one
   route. The mode page would need to decide between "play" and "show results", and an unfinished
   run has no sensible response — the same URL sometimes plays, sometimes shows results.
3. **A dedicated route `/result/<runId>`** (chosen). A server component resolves the run through
   the same narrow projection the run endpoints use (`loadRunSnapshot`), loads the mode, scores
   it with the same pure `scoreRun`, and renders the same `ResultsScene` component the in-game
   ending uses. The URL is stable, server-rendered, and shareable forever.

## Decision

- **Route**: `GET /result/<runId>`. `result` is added to `RESERVED_MODE_SLUGS` so no admin can
  create a mode that shadows the permalink namespace.
- **Data**: the route may only see `RunSnapshot` (runId, modeSlug, knightName, answerCount,
  complete, answers) — exactly the projection the player endpoints already return. Company name,
  industry and report internals are unreachable from this page by construction.
- **Scoring**: `scoreRun(sections, answers)` (pure, in `src/game/scoring.ts`) is the single
  implementation used by both the in-game results scene and the permalink route. Sections are
  scored against the mode's *current* questions; a removed question's stale answer can never
  skew a score.
- **Unknown runId** → 404 (no fallback, matching the unknown-mode rule).
- **Unfinished run** → redirect to `/<modeSlug>?run=<runId>`; the game shell adopts the runId,
  resumes at the frontier and adopts it as the session's run pointer. This makes a mid-run link
  genuinely useful ("finish your training") without a second results-free screen.
- **Both surfaces render one component** (`ResultsScene`) with the same props — the in-game
  ending and the permalink can never drift apart visually or numerically.

## Consequences

- The run id remains the only credential (ADR 0002): unguessable uuid, no auth, no expiry.
- Deleting a submission removes its permalink (404). The brief says links "must not expire";
  deliberate admin deletion is out of scope for that promise.
- The permalink shows the mode *as currently configured*. Re-skinning a mode after a run
  changes the permalink's styling and section names — acceptable and arguably correct: the mode
  owns presentation, the run owns the scores.
- If a future milestone adds the QWEN report (M7), it extends `RunSnapshot`/`ResultsScene` —
  the route shape does not change.
