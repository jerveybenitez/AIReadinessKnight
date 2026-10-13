import type { Payload, PayloadRequest } from 'payload'

import { MAX_ANSWERS, type FinalBandKey, type SectionBandKey, type SectionKey } from './constants'
import { fallbackReport, validateReport, type Report, type ReportInput, type ReportState } from './report'
import { scoreRun } from './scoring'
import type { Mode, Submission } from '@/payload-types'

/**
 * Server-only report generation (qwen-report skill, QODER.md §5). The rules this module enforces:
 *
 * - The endpoint is env-driven: base URL, model and key come from QWEN_BASE_URL / QWEN_API_KEY /
 *   QWEN_MODEL (plus QWEN_DISABLE_THINKING for hybrid reasoning models — see qwenConfig). Nothing
 *   vendor-specific is written in source; a blank key sends no Authorization header (normal
 *   locally) and is not an error.
 * - The report is generated once per run and cached on the submission doc — a refresh re-reads,
 *   it never re-bills. Concurrent requests for the same run join one in-flight promise.
 * - Every failure mode (missing config, network, timeout, non-2xx, malformed JSON, invalid shape)
 *   degrades to the deterministic `fallbackReport` — the player always gets a complete report.
 * - The prompt contains the company's answers; it is never logged, and neither are responses.
 */

export interface QwenConfig {
  baseUrl: string | null
  apiKey: string
  model: string | null
  /**
   * When true, sends `enable_thinking: false` in the request body. Hybrid reasoning models
   * (qwen3.x and friends) otherwise burn 20–30s of hidden reasoning on a report-shaped prompt
   * and race the timeout; for this templated JSON task the thinking pass buys nothing. Kept
   * env-driven so the source stays vendor-neutral: vanilla OpenAI-compatible servers keep the
   * default shape, and the knob is dropped if the endpoint is swapped.
   */
  disableThinking: boolean
}

export function qwenConfig(env: Record<string, string | undefined> = process.env): QwenConfig {
  const baseUrl = (env.QWEN_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const disableThinking = /^(1|true|yes)$/i.test((env.QWEN_DISABLE_THINKING ?? '').trim())
  return {
    baseUrl: baseUrl || null,
    apiKey: (env.QWEN_API_KEY ?? '').trim(),
    model: (env.QWEN_MODEL ?? '').trim() || null,
    disableThinking,
  }
}

// --- prompt construction ----------------------------------------------------------------------

export interface PromptQuestion {
  question: string
  answer: string
}

export interface PromptSection {
  name: string
  mean: string
  band: string
  questions: PromptQuestion[]
}

export interface PromptInput {
  companyName: string
  industry: string
  finalMean: string
  finalBand: string
  sections: PromptSection[]
}

export interface RunScoresField {
  sections: Array<{ key: SectionKey; mean: number; band: SectionBandKey }>
  finalMean: number
  finalBand: FinalBandKey
}

export interface ReportContext {
  prompt: PromptInput
  fallback: ReportInput
  /** The same numbers, in the shape of the submissions `scores` field — cached with the report. */
  scores: RunScoresField
}

/**
 * One scoring pass that feeds the prompt, the fallback and the cached `scores` document field.
 * Scores are never recomputed anywhere else (qwen-report skill failure mode #5).
 */
export function reportInputs(run: Submission, mode: Mode): ReportContext {
  const answerRows = run.answers ?? []
  const byQuestionId = new Map(answerRows.map((row) => [row.questionId, row]))
  const firstOptionText = (question: { options?: { text?: string | null }[] | null }, optionIndex: number) =>
    question.options?.[optionIndex]?.text?.trim() || '(no answer)'

  const score = scoreRun(
    (mode.sections ?? []).map((section) => ({
      key: section.key as SectionKey,
      questionIds: (section.questions ?? []).map((question) => question.id),
    })),
    Object.fromEntries(
      answerRows.map((row) => [
        row.questionId,
        {
          questionId: row.questionId,
          sectionKey: row.sectionKey as SectionKey,
          optionIndex: row.optionIndex,
          score: row.score,
        },
      ]),
    ),
  )
  const scoredByKey = new Map(score.sections.map((section) => [section.key, section]))

  const fallbackSections: ReportInput['sections'] = []
  const promptSections: PromptSection[] = []

  for (const section of mode.sections ?? []) {
    const key = section.key as SectionKey
    const scored = scoredByKey.get(key)
    const mean = scored?.mean ?? 0
    const band = scored?.band ?? '0-0.9'
    fallbackSections.push({ key, name: section.name ?? key, mean, band })
    promptSections.push({
      name: section.name ?? key,
      mean: mean.toFixed(1),
      band,
      questions: (section.questions ?? []).map((question) => ({
        question: question.text ?? '',
        answer: firstOptionText(question, byQuestionId.get(question.id)?.optionIndex ?? -1),
      })),
    })
  }

  return {
    prompt: {
      companyName: run.companyName,
      industry: run.industry?.trim() || 'not given',
      finalMean: score.mean.toFixed(1),
      finalBand: score.band,
      sections: promptSections,
    },
    fallback: {
      companyName: run.companyName,
      industry: run.industry?.trim() || '',
      sections: fallbackSections,
      finalMean: score.mean,
      finalBand: score.band,
    },
    scores: {
      sections: score.sections.map((section) => ({ key: section.key, mean: section.mean, band: section.band })),
      finalMean: score.mean,
      finalBand: score.band,
    },
  }
}

const OUTPUT_CONTRACT = [
  'Respond with a single JSON object and nothing else — no markdown fences, no commentary.',
  'Shape: {"headline": string (one sentence), "summary": string (2-4 sentences, plain language),',
  '"strengths": string[] (1-3), "gaps": string[] (1-3, weakest first),',
  '"nextSteps": [{"title": string, "detail": string, "horizon": "now" | "90-days" | "12-months"}] (3-5, prioritised)}',
].join(' ')

export function buildSystemMessage(ai: { systemPrompt: string; tone: string; guidance: string }): string {
  return [
    ai.systemPrompt.trim(),
    ai.tone.trim() ? `Tone: ${ai.tone.trim()}.` : '',
    ai.guidance.trim(),
    OUTPUT_CONTRACT,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildUserMessage(prompt: PromptInput): string {
  const lines: string[] = [
    `Company: ${prompt.companyName}`,
    `Industry: ${prompt.industry}`,
    `Overall readiness: mean ${prompt.finalMean} / 4 (band ${prompt.finalBand})`,
    '',
  ]
  for (const section of prompt.sections) {
    lines.push(`## ${section.name} — mean ${section.mean} / 4 (band ${section.band})`)
    for (const question of section.questions) {
      lines.push(`Q: ${question.question}`)
      lines.push(`Answer: ${question.answer}`)
    }
    lines.push('')
  }
  lines.push('Write the readiness report for this company from the data above.')
  return lines.join('\n')
}

// --- model-output parsing ---------------------------------------------------------------------

/** Strip markdown fences and surrounding prose, then locate the JSON object. */
export function extractJsonObject(raw: string): string | null {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

export type ParsedContent = { report: Report; reason: null } | { report: null; reason: 'malformed-json' | 'invalid-shape' }

export function parseReportContent(raw: unknown): ParsedContent {
  if (typeof raw !== 'string' || raw.trim().length === 0) return { report: null, reason: 'malformed-json' }
  const json = extractJsonObject(raw)
  if (!json) return { report: null, reason: 'malformed-json' }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { report: null, reason: 'malformed-json' }
  }
  const report = validateReport(parsed)
  if (!report) return { report: null, reason: 'invalid-shape' }
  return { report, reason: null }
}

// --- the call ---------------------------------------------------------------------------------

export type QwenAttempt = { ok: true; report: Report } | { ok: false; reason: string }

export interface AttemptOptions {
  timeoutMs?: number
  retryDelayMs?: number
  fetchImpl?: typeof fetch
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * One user-visible attempt at the model, timeout-bounded and retried once on transient failures
 * (429 / 5xx / network / timeout). A schema failure is never retried — the same prompt will not
 * produce a different shape (qwen-report skill).
 */
export async function requestQwenReport(
  prompt: PromptInput,
  ai: { systemPrompt: string; tone: string; guidance: string },
  config: QwenConfig,
  options: AttemptOptions = {},
): Promise<QwenAttempt> {
  if (!config.baseUrl || !config.model) return { ok: false, reason: 'missing-config' }

  const fetchFn = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 25_000
  const retryDelayMs = options.retryDelayMs ?? 800

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
  const body = JSON.stringify({
    model: config.model,
    temperature: 0.4,
    ...(config.disableThinking ? { enable_thinking: false } : {}),
    messages: [
      { role: 'system', content: buildSystemMessage(ai) },
      { role: 'user', content: buildUserMessage(prompt) },
    ],
  })

  let lastReason = 'network-error'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response
    try {
      response = await fetchFn(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (cause) {
      // DOMException is not an instanceof Error in Node — read the name structurally.
      const name = cause && typeof cause === 'object' && 'name' in cause ? (cause as { name: unknown }).name : null
      lastReason = name === 'TimeoutError' ? 'timeout' : 'network-error'
      if (attempt === 0) {
        await sleep(retryDelayMs)
        continue
      }
      return { ok: false, reason: lastReason }
    }

    if (!response.ok) {
      lastReason = `http-${response.status}`
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await sleep(retryDelayMs)
        continue
      }
      return { ok: false, reason: lastReason }
    }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      return { ok: false, reason: 'malformed-json' }
    }
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message
      ?.content
    const parsed = parseReportContent(content)
    return parsed.report ? { ok: true, report: parsed.report } : { ok: false, reason: parsed.reason }
  }
  return { ok: false, reason: lastReason }
}

// --- orchestration: cache once per run --------------------------------------------------------

/** The cached report on the doc, re-validated — stored JSON is still data, not a promise. */
export function storedReportOf(run: Submission): ReportState | null {
  const status = run.report?.status
  if (status !== 'ready' && status !== 'fallback') return null
  const report = validateReport(run.report?.data)
  return report ? { status, report } : null
}

export interface ReportGeneration {
  state: ReportState
  /** Why the fallback fired; null when QWEN produced the report or the cache was hit. */
  reason: string | null
}

/** Concurrent callers for one run join a single generation — the free-API hazard, closed. */
const inFlight = new Map<string, Promise<ReportGeneration>>()

/**
 * Generate (or re-read) the report for a completed run. The result is written to the submission's
 * `report` field — status, data, generatedAt — together with the computed `scores`, so a refresh
 * never re-bills a model call.
 */
export async function generateReportForRun(
  payload: Payload,
  run: Submission,
  mode: Mode,
  req?: PayloadRequest,
): Promise<ReportGeneration> {
  const cached = storedReportOf(run)
  if (cached) return { state: cached, reason: null }

  const pending = inFlight.get(run.runId)
  if (pending) return pending

  const work = (async (): Promise<ReportGeneration> => {
    const context = reportInputs(run, mode)
    const attempt = await requestQwenReport(
      context.prompt,
      {
        systemPrompt: mode.ai?.systemPrompt ?? '',
        tone: mode.ai?.tone ?? '',
        guidance: mode.ai?.guidance ?? '',
      },
      qwenConfig(),
    )

    let state: ReportState
    let reason: string | null = null
    if (attempt.ok) {
      state = { status: 'ready', report: attempt.report }
    } else {
      reason = attempt.reason
      state = { status: 'fallback', report: fallbackReport(context.fallback) }
      // Diagnosable degradation without any answer content or company data (§6).
      payload.logger.warn(`[report] QWEN unavailable — using the template report (${reason})`)
    }

    await payload.update({
      collection: 'submissions',
      id: run.id,
      data: {
        scores: context.scores,
        report: {
          status: state.status,
          // Payload's json field type wants an index-signature object; Report is a plain
          // JSON-safe shape validated by validateReport before it ever gets here.
          data: state.report as unknown as Record<string, unknown>,
          generatedAt: new Date().toISOString(),
        },
      },
      req,
      overrideAccess: true,
    })

    return { state, reason }
  })()

  inFlight.set(run.runId, work)
  try {
    return await work
  } finally {
    inFlight.delete(run.runId)
  }
}

/** Exposed for the endpoint's completeness gate (and tests). */
export const requiredAnswerCount = MAX_ANSWERS
