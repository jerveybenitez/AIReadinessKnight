# ADR 0002 — Run state, persistence and resume

Status: accepted (2026-10-13)

## Options

1. **Client-only state** (React state / localStorage) — server touched only at the end.
2. **Server-authoritative run** — a submission row is created at intake with an unguessable
   `runId`; every answer is written to it as the player plays; `sessionStorage` mirrors only the
   `runId` so a refresh re-attaches.
3. Hybrid: batch answers to the server at section boundaries.

## Choice

Option 2.

## Why

- The brief requires: progress survives an accidental refresh; a closed tab mid-run still leaves a
  resumable run; the result permalink is shareable and permanent; answers are stored server-side.
  Only server-authoritative state satisfies all of these with no sync surprises.
- **Replay replaces**, never appends: answers live as `Record<questionId, Answer>` — in the wire
  format too (one `answers` row per question id, enforced by collection validation). There is no
  code path where re-answering can inflate a score.
- **The runId is the access token for the result link** (§6 of the brief). Creating it at intake
  means the permalink exists from the first answer; nothing about the link changes later.
- `sessionStorage` (not `localStorage`) holds only the opaque `runId` — never answers or company
  data. Another origin cannot read it, and it dies with the tab, which is the right lifetime.

## What it costs

- One network write per answer (15 per run) — trivial.
- The server must validate every answer against the mode's questions before storing it (it does:
  score is recomputed server-side from the mode, the client's number is never trusted).
- Public endpoints keyed by runId need care: the responses are **narrow projections** (scores, pose,
  report progress) — never the raw submission document, which contains company identifiers.

## Rejected

- Client-only: violates the refresh/closed-tab requirement and makes the permalink fake (nothing
  durable behind it until the end).
- LocalStorage answers: explicitly forbidden by the skill (readable by other scripts); and it
  duplicates server state, creating merge conflicts on resume.
