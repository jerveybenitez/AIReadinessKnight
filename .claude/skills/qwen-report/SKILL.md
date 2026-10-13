---
name: qwen-report
description: Use when building or debugging the QWEN-generated AI-readiness report at the end of the AI-Ready Knight game — prompt construction, structured JSON output, validation, caching against a run, fallbacks when the API is missing or failing, and keeping the API key server-side. Use when the report is empty, malformed, slow, leaking keys, or re-billing on refresh.
---

# AI-Ready Knight — QWEN Report

At the end of a playthrough, QWEN turns scores into a readiness summary and prioritised next steps,
tailored to the company and industry. It is the payoff of the assessment — and the one part of the
app that depends on a third party, so it must never be able to break the results screen.

## Non-negotiables

1. **Server-side only.** The key lives in `.env` as `QWEN_API_KEY` and is read in a route handler
   or server action. If it can appear in a client bundle, it is already leaked. Never prefix it
   `NEXT_PUBLIC_`.
2. **The player sees their score immediately.** Scores are computed locally and rendered before the
   report exists. The report streams in or polls. A QWEN outage degrades the page; it never blocks
   it.
3. **Generate once per run.** Cache the report on the `submissions` doc keyed by `runId`. A refresh
   re-reads; it does not re-bill.
4. **Model output is untrusted data.** Validate the shape, render as text. Never `dangerouslySet
   InnerHTML`, never feed it into a query or a shell.

## Env — localhost for now

There is **no hosted QWEN endpoint yet**. Develop against a local OpenAI-compatible server.

```
QWEN_BASE_URL=http://localhost:11434/v1   # local server; adjust to whatever is running
QWEN_API_KEY=                             # often blank locally
QWEN_MODEL=qwen2.5
```

- **Nothing vendor-specific in source.** No hardcoded URL, model name or key — moving to a hosted
  endpoint later must be a pure `.env` change.
- Assume an **OpenAI-compatible** chat-completions shape. If the local server the user is running
  turns out to speak something else, ask rather than writing an adapter on spec.
- A blank `QWEN_API_KEY` is **normal locally** and must not be treated as a fatal misconfiguration.
  Send no `Authorization` header when it's empty; don't throw.
- The endpoint will frequently be **down** during development. That is the expected state, not an
  error worth surfacing to the player — it's exactly what the fallback is for.

## Input to the model

Build the prompt from data you already have — don't re-derive scores here, import from
`src/game/scoring.ts`:

- company name, industry
- per-section mean + band, and the final mean + band
- for each of the 15 questions: the question text and the **chosen option text** (not just the
  number — the wording is the signal)
- the mode's `ai.systemPrompt` and tone guidance, so a client-specific mode can steer the report

Keep the system prompt in the CMS, not hardcoded. That is the whole point of modes.

## Structured output

Ask for JSON and validate it. Free-form prose is unrenderable and untestable.

```ts
type Report = {
  headline: string                 // one sentence
  summary: string                  // 2–4 sentences, plain language
  strengths: string[]              // 1–3
  gaps: string[]                   // 1–3, weakest sections first
  nextSteps: Array<{
    title: string
    detail: string
    horizon: 'now' | '90-days' | '12-months'
  }>                               // 3–5, prioritised
}
```

Validate with a schema before it reaches a component. On a validation failure, treat it exactly as
an API failure and fall back — a half-parsed report rendered with `undefined` holes is worse than a
template.

## Fallback — build this first

A deterministic, template-based report built purely from the scores and band. No network. It must
be genuinely useful, not an error message:

- band-appropriate headline and summary
- the two weakest sections named, with their standard remediation steps
- generic-but-real next steps per band

Build the fallback **before** the live integration. With the endpoint on localhost and usually not
running, this is the path you will exercise most — it is the default experience during development,
not an edge case. It also gives you something to diff model output against, and means the outage
path is tested by default rather than discovered in production.

Trigger the fallback on: missing key, network error, non-2xx, timeout, malformed JSON, schema
validation failure. Log which one fired (server-side, without answer content) so a silent
degradation is diagnosable.

## Reliability

- **Timeout** every call (~20–30s) and race it against the fallback.
- **Retry once** on a transient failure (429/5xx) with backoff. Do not retry a schema failure with
  the same prompt and expect a different shape.
- **Rate limit** the generate endpoint by run id — it must not be a free text-generation API for
  anyone who finds the URL.
- **Only generate for a complete run.** 15 answers or refuse.

## Privacy

The prompt contains a real company's name, industry and self-declared weaknesses.

- Do not log prompt or response bodies in production.
- Do not send anything the report doesn't need — no emails, no internal ids.
- Mention on the intake form that answers are stored and used to generate the report. One sentence.
- If the user later wants a no-third-party mode, the fallback already is one; keep it maintained.

## Testing

- Unit-test the schema validator against: valid output, missing field, wrong type, extra fields,
  truncated JSON, JSON wrapped in prose/markdown fences (very common — strip fences before parsing).
- Unit-test the fallback report for each of the three bands.
- Test with `QWEN_BASE_URL` pointing at nothing and `QWEN_API_KEY` unset — the results screen must
  still render a complete report. This is the default local state, so it should be the default test
  state too.
- Do not hit a live endpoint in CI.

## Common failure modes

1. **Key in the client bundle** via a `NEXT_PUBLIC_` prefix or a client-component import chain.
   Check the built output, not just the source.
2. **Report generation blocking the results render**, so a slow API looks like a broken game.
3. **Regenerating on every page view** — a refresh loop quietly burns the client's quota.
4. **Parsing ```json fences** as JSON and throwing. Strip fences, then parse, then validate.
5. **Scores recomputed inside the prompt builder** and drifting from the results screen. Import the
   one scoring module.
6. **Rendering model text as HTML.** Render as text.
7. **Hardcoding the system prompt**, which silently disables per-mode tailoring — the feature the
   backend exists for.
