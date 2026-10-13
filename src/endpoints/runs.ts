import type { Endpoint, PayloadRequest } from 'payload'

import type { Answer, AnswerAck, ReportAck } from '../game/types'
import { generateReportForRun, requiredAnswerCount } from '../game/report-server'
import { findRun, loadRunSnapshot } from '../game/run-server'
import type { Mode } from '@/payload-types'

/**
 * Player-facing run endpoints, mounted under /api/submissions.
 *
 * These are the ONLY way the public game touches runs. The submissions collection itself is
 * closed to anonymous access; every handler here returns a narrow projection and never the raw
 * submission document (see §6 of the build brief). Authorization = knowing the unguessable runId.
 */

const MAX_FIELD = 120

const asTrimmed = (value: unknown, max = MAX_FIELD): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return null
  return trimmed
}

const error = (message: string, status: number) => Response.json({ error: message }, { status })

async function readBody(req: PayloadRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json?.()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

/** POST /api/submissions/runs/create — intake; returns the runId that keys everything else. */
export const createRunEndpoint: Endpoint = {
  path: '/runs/create',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    if (!body) return error('Invalid request body', 400)

    const knightName = asTrimmed(body.knightName)
    const companyName = asTrimmed(body.companyName)
    const industry = asTrimmed(body.industry ?? '') ?? ''
    const modeSlug = asTrimmed(body.modeSlug, 60)

    if (!knightName) return error('Knight name is required (max 120 characters)', 400)
    if (!companyName) return error('Company name is required (max 120 characters)', 400)
    if (!modeSlug) return error('Mode slug is required', 400)

    const { docs } = await req.payload.find({
      collection: 'modes',
      where: { slug: { equals: modeSlug } },
      limit: 1,
      depth: 0,
      req,
    })
    const mode = docs[0]
    if (!mode) return error('Unknown mode', 404)

    const runId = crypto.randomUUID()
    await req.payload.create({
      collection: 'submissions',
      data: {
        runId,
        mode: mode.id,
        knightName,
        companyName,
        industry,
        answers: [],
        report: { status: 'pending' },
      },
      req,
      overrideAccess: true, // collection is closed to anonymous create; this endpoint is the gate
    })

    return Response.json({ runId }, { status: 201 })
  },
}

/** GET /api/submissions/runs/:runId — narrow run state for resume. */
export const getRunEndpoint: Endpoint = {
  path: '/runs/:runId',
  method: 'get',
  handler: async (req) => {
    const runId = typeof req.routeParams?.runId === 'string' ? req.routeParams.runId : ''
    if (!runId) return error('Missing run id', 400)

    const snapshot = await loadRunSnapshot(req.payload, runId, req)
    if (!snapshot) return error('Run not found', 404)

    return Response.json(snapshot)
  },
}

/** POST /api/submissions/runs/:runId/answer — store one answer (replace on replay). */
export const answerEndpoint: Endpoint = {
  path: '/runs/:runId/answer',
  method: 'post',
  handler: async (req) => {
    const runId = typeof req.routeParams?.runId === 'string' ? req.routeParams.runId : ''
    if (!runId) return error('Missing run id', 400)

    const body = await readBody(req)
    if (!body) return error('Invalid request body', 400)

    const questionId = asTrimmed(body.questionId, 64)
    const optionIndex = body.optionIndex
    if (!questionId) return error('questionId is required', 400)
    if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex) || optionIndex < 0) {
      return error('optionIndex must be a non-negative integer', 400)
    }

    const run = await findRun(req.payload, runId, req)
    if (!run) return error('Run not found', 404)

    const mode = (await req.payload.findByID({
      collection: 'modes',
      id: typeof run.mode === 'number' ? run.mode : Number((run.mode as Mode).id),
      depth: 0,
      req,
    })) as Mode

    // The server derives sectionKey and score from the mode — client numbers are never trusted.
    let answer: Answer | null = null
    let totalQuestions = 0
    for (const section of mode.sections ?? []) {
      for (const question of section.questions ?? []) {
        totalQuestions += 1
        if (question.key === questionId) {
          const option = question.options?.[optionIndex]
          if (!option) return error(`Option ${optionIndex} does not exist for this question`, 400)
          answer = {
            questionId,
            sectionKey: section.key,
            optionIndex,
            score: option.score,
          }
        }
      }
    }
    if (!answer) return error('Unknown question for this mode', 400)

    const existing = run.answers ?? []
    const replaced = existing.filter((a) => a.questionId !== questionId)
    const answers = [...replaced.map((a) => ({ questionId: a.questionId, sectionKey: a.sectionKey, optionIndex: a.optionIndex, score: a.score })), answer]

    await req.payload.update({
      collection: 'submissions',
      id: run.id,
      data: { answers },
      req,
      overrideAccess: true,
    })

    const ack: AnswerAck = {
      runId,
      answerCount: answers.length,
      complete: answers.length >= totalQuestions,
    }
    return Response.json(ack)
  },
}

/**
 * POST /api/submissions/runs/:runId/report — the readiness report, generated at most once per run
 * and cached on the submission. Complete runs only; concurrent calls join one generation.
 */
export const reportEndpoint: Endpoint = {
  path: '/runs/:runId/report',
  method: 'post',
  handler: async (req) => {
    const runId = typeof req.routeParams?.runId === 'string' ? req.routeParams.runId : ''
    if (!runId) return error('Missing run id', 400)

    const run = await findRun(req.payload, runId, req)
    if (!run) return error('Run not found', 404)
    if ((run.answers ?? []).length < requiredAnswerCount) {
      return error('The report can only be written for a completed run', 400)
    }

    const mode = (await req.payload.findByID({
      collection: 'modes',
      id: typeof run.mode === 'number' ? run.mode : Number((run.mode as Mode).id),
      depth: 0,
      req,
    })) as Mode

    const generated = await generateReportForRun(req.payload, run, mode, req)
    const ack: ReportAck = { runId, status: generated.state.status, report: generated.state.report }
    return Response.json(ack)
  },
}
