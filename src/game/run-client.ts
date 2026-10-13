/**
 * Client-side access to the run endpoints. The only thing persisted locally is the opaque
 * runId in sessionStorage (never answers, never company data — see ADR 0002).
 */
import type { Answer, AnswerAck, RunSnapshot } from './types'

const ENDPOINTS = {
  create: '/api/submissions/runs/create',
  run: (runId: string) => `/api/submissions/runs/${encodeURIComponent(runId)}`,
  answer: (runId: string) => `/api/submissions/runs/${encodeURIComponent(runId)}/answer`,
}

export class RunRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RunRequestError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new RunRequestError('Network error — is the server running?', 0)
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${res.status})`
    throw new RunRequestError(message, res.status)
  }
  return body as T
}

export interface CreateRunInput {
  modeSlug: string
  knightName: string
  companyName: string
  industry: string
}

export async function createRun(input: CreateRunInput): Promise<{ runId: string }> {
  return request<{ runId: string }>(ENDPOINTS.create, { method: 'POST', body: JSON.stringify(input) })
}

/** Null when the run does not exist (or was deleted) — the caller decides whether to start fresh. */
export async function fetchRun(runId: string): Promise<RunSnapshot | null> {
  try {
    return await request<RunSnapshot>(ENDPOINTS.run(runId))
  } catch (error) {
    if (error instanceof RunRequestError && error.status === 404) return null
    throw error
  }
}

export async function submitAnswer(
  runId: string,
  answer: Pick<Answer, 'questionId' | 'optionIndex'>,
): Promise<AnswerAck> {
  return request<AnswerAck>(ENDPOINTS.answer(runId), {
    method: 'POST',
    body: JSON.stringify(answer),
  })
}

// --- sessionStorage run pointer -------------------------------------------------------------

const runKey = (modeSlug: string) => `ark:run:${modeSlug}`

export function saveRunId(modeSlug: string, runId: string): void {
  try {
    window.sessionStorage.setItem(runKey(modeSlug), runId)
  } catch {
    // sessionStorage unavailable (private mode etc.) — the run still works, resume is best-effort
  }
}

export function readRunId(modeSlug: string): string | null {
  try {
    return window.sessionStorage.getItem(runKey(modeSlug))
  } catch {
    return null
  }
}

export function clearRunId(modeSlug: string): void {
  try {
    window.sessionStorage.removeItem(runKey(modeSlug))
  } catch {
    /* ignore */
  }
}
