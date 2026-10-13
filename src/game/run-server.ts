import type { Payload, PayloadRequest } from 'payload'

import type { RunSnapshot } from './types'
import type { Mode, Submission } from '@/payload-types'

/**
 * Server-only run loading — the narrow RunSnapshot projection (§6: "return a narrow projection,
 * not the whole submission document").
 *
 * Shared by the player-facing run endpoints (src/endpoints/runs.ts) and the permalink route
 * (/result/[runId]) so both surfaces read runs identically and expose exactly the same fields.
 * The raw submission (company, industry, report internals) never leaves this module.
 */

export async function findRun(
  payload: Payload,
  runId: string,
  req?: PayloadRequest,
): Promise<Submission | null> {
  const { docs } = await payload.find({
    collection: 'submissions',
    where: { runId: { equals: runId } },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true, // server-side surface; access is the unguessable runId itself
  })
  return docs[0] ?? null
}

export async function modeSlugOf(
  payload: Payload,
  mode: Submission['mode'],
  req?: PayloadRequest,
): Promise<string> {
  if (typeof mode === 'object' && mode !== null) return (mode as Mode).slug
  const doc = await payload.findByID({
    collection: 'modes',
    id: typeof mode === 'number' ? mode : Number(mode),
    depth: 0,
    req,
  })
  return (doc as Mode).slug
}

export function snapshotOf(run: Submission, modeSlug: string): RunSnapshot {
  const answers = (run.answers ?? []).map((a) => ({
    questionId: a.questionId,
    sectionKey: a.sectionKey,
    optionIndex: a.optionIndex,
    score: a.score,
  }))
  return {
    runId: run.runId,
    modeSlug,
    knightName: run.knightName,
    answerCount: answers.length,
    complete: answers.length >= 15,
    answers,
  }
}

/** Load a run by its unguessable id into the narrow projection. Null means "no such run". */
export async function loadRunSnapshot(
  payload: Payload,
  runId: string,
  req?: PayloadRequest,
): Promise<RunSnapshot | null> {
  const run = await findRun(payload, runId, req)
  if (!run) return null
  return snapshotOf(run, await modeSlugOf(payload, run.mode, req))
}
