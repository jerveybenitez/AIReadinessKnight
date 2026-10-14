'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { audioEngine } from './audio/engine'
import { Stage } from './components/Stage'
import { canGoBack, initialState, reduce, type GameState, type GameEvent } from './machine'
import type { ReportState } from './report'
import { clearRunId, createRun, fetchRun, readRunId, saveRunId, submitAnswer } from './run-client'
import { scoreRun } from './scoring'
import { IntakeScene, type IntakeFields } from './scenes/Intake'
import { QuestionScene, type QuestionAction } from './scenes/Question'
import { ResultsScene } from './scenes/Results'
import { SectionEndScene } from './scenes/SectionEnd'
import { TitleScene } from './scenes/Title'
import type { Answer, AnswerMap, ResolvedMode, RunSnapshot } from './types'
import './game.css'

/**
 * The stage shell: owns the machine instance, the run pointer, and the server writes.
 * Everything about "where am I" lives in the machine (src/game/machine.ts); this component only
 * wires events to it and renders the resulting scene.
 *
 * `initialRunId` arrives from ?run= on the mode URL — the mid-run permalink handed to someone in
 * a fresh browser. It is tried before the session's own stored pointer; the first valid run for
 * this mode wins and becomes the session's pointer.
 */

interface RunMeta {
  runId: string
  knightName: string
  /** Cached report from the resume snapshot; the results screen generates one when null (M7). */
  report: ReportState | null
}

type Phase = { name: 'resuming' } | { name: 'ready' } | { name: 'resume-error'; message: string }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function GameShell({ mode, initialRunId }: { mode: ResolvedMode; initialRunId?: string }) {
  const sections = useMemo(
    () => mode.sections.map((section) => ({ key: section.key, questionIds: section.questions.map((q) => q.id) })),
    [mode],
  )
  const [state, dispatch] = useReducer(
    (current: GameState, event: GameEvent) => reduce(current, event, sections),
    undefined,
    initialState,
  )

  const [phase, setPhase] = useState<Phase>({ name: 'resuming' })
  const [resumeAttempt, setResumeAttempt] = useState(0)
  const [run, setRun] = useState<RunMeta | null>(null)
  const [pendingAnswer, setPendingAnswer] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [actionFor, setActionFor] = useState<QuestionAction | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  // A failed answer write gets the error sound alongside its visible banner. Audio is a pure
  // announcement here — it never touches the retry path (§3.7: degrade, never block).
  useEffect(() => {
    if (answerError) audioEngine.play('ui-error')
  }, [answerError])

  // Resume, in priority order: the ?run= pointer from the URL (a permalink handed to this
  // browser), then the session's own pointer for this mode (ADR 0002). The first run that
  // exists and belongs to this mode wins; stale pointers are cleared, never adopted.
  useEffect(() => {
    let cancelled = false
    const storedId = readRunId(mode.slug)

    const load = async (): Promise<RunSnapshot | null> => {
      const candidates = [...new Set([initialRunId, storedId].filter((id): id is string => Boolean(id)))]
      for (const id of candidates) {
        const snapshot = await fetchRun(id)
        if (snapshot && snapshot.modeSlug === mode.slug) return snapshot
        if (id === storedId) clearRunId(mode.slug) // deleted run, or one that belongs to another mode
      }
      return null
    }

    load()
      .then((snapshot) => {
        if (cancelled) return
        if (!snapshot) {
          setRun(null)
        } else {
          const answers: AnswerMap = {}
          for (const answer of snapshot.answers) answers[answer.questionId] = answer
          saveRunId(mode.slug, snapshot.runId) // an adopted permalink sticks for the session
          setRun({ runId: snapshot.runId, knightName: snapshot.knightName, report: snapshot.report })
          dispatch({ type: 'RESUME', answers })
        }
        setPhase({ name: 'ready' })
      })
      .catch((cause) => {
        if (cancelled) return
        setPhase({
          name: 'resume-error',
          message: cause instanceof Error ? cause.message : 'Could not reach the server.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [mode.slug, resumeAttempt, initialRunId])

  const handleIntakeDone = useCallback(
    async (fields: IntakeFields) => {
      const { runId } = await createRun({ modeSlug: mode.slug, ...fields })
      saveRunId(mode.slug, runId)
      setRun({ runId, knightName: fields.knightName, report: null })
      dispatch({ type: 'INTAKE_DONE' })
    },
    [mode.slug],
  )

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (!run || pendingAnswer || state.scene.name !== 'question') return
      const section = mode.sections[state.scene.sectionIndex]
      const question = section?.questions[state.scene.questionIndex]
      const option = question?.options[optionIndex]
      if (!section || !question || !option) return

      setPendingAnswer(true)
      setAnswerError(null)
      try {
        await submitAnswer(run.runId, { questionId: question.id, optionIndex })
        const answer: Answer = {
          questionId: question.id,
          sectionKey: section.key,
          optionIndex,
          score: option.score,
        }
        dispatch({ type: 'ANSWER', answer })
        setActionFor({ questionId: question.id, optionIndex })
      } catch (cause) {
        setAnswerError(cause instanceof Error ? cause.message : 'Could not record your answer.')
      } finally {
        setPendingAnswer(false)
      }
    },
    [run, pendingAnswer, state.scene, mode.sections],
  )

  // The attack choreography lives in the question scene and reports back exactly once — when the
  // animation finishes, when the player skips it, or immediately under reduced motion. Game state
  // advanced as soon as the answer was stored; this callback only moves the machine on.
  const handleActionComplete = useCallback(() => {
    setActionFor(null)
    dispatch({ type: 'ADVANCE' })
  }, [])

  // Focus follows the scene: keyboard players land on the new screen's heading — including the
  // resume-error recovery screen, which a keyboard user must be able to act on. During the
  // 'resuming' phase there is no heading to focus, so the query is simply a no-op.
  const sceneRef = useRef<HTMLDivElement>(null)
  const sceneKey =
    state.scene.name === 'question'
      ? `question:${state.scene.sectionIndex}:${state.scene.questionIndex}`
      : state.scene.name
  useEffect(() => {
    sceneRef.current?.querySelector<HTMLElement>('h1, h2')?.focus()
  }, [sceneKey, phase.name])

  const advance = useCallback(() => {
    setActionFor(null)
    setAnswerError(null)
    dispatch({ type: 'ADVANCE' })
  }, [])

  const goBack = useCallback(() => {
    setActionFor(null)
    setAnswerError(null)
    dispatch({ type: 'BACK' })
  }, [])

  const renderScene = () => {
    const scene = state.scene
    switch (scene.name) {
      case 'title':
        return (
          <TitleScene
            mode={mode}
            onStart={() => {
              // The canonical audio unlock: the first real interaction (§3.7). The engine is
              // idempotent, and Stage's gesture listener covers every other route.
              audioEngine.unlock()
              audioEngine.play('ui-select')
              dispatch({ type: 'START' })
            }}
          />
        )
      case 'intake':
        return <IntakeScene mode={mode} onDone={handleIntakeDone} />
      case 'question': {
        const section = mode.sections[scene.sectionIndex]
        const question = section?.questions[scene.questionIndex]
        return (
          <QuestionScene
            key={question?.id ?? `question:${scene.sectionIndex}:${scene.questionIndex}`}
            mode={mode}
            sectionIndex={scene.sectionIndex}
            questionIndex={scene.questionIndex}
            answered={question ? state.answers[question.id] : undefined}
            pending={pendingAnswer}
            action={actionFor && question?.id === actionFor.questionId ? actionFor : null}
            reducedMotion={reducedMotion}
            onAnswer={handleAnswer}
            onActionComplete={handleActionComplete}
            onBack={goBack}
            onAdvance={advance}
            canGoBack={canGoBack(state)}
          />
        )
      }
      case 'sectionEnd':
        return (
          <SectionEndScene
            mode={mode}
            sectionIndex={scene.sectionIndex}
            answers={state.answers}
            onContinue={advance}
          />
        )
      case 'results':
        return (
          <ResultsScene
            mode={mode}
            knightName={run?.knightName ?? 'knight'}
            runId={run?.runId ?? ''}
            score={scoreRun(sections, state.answers)}
            initialReport={run?.report ?? null}
          />
        )
    }
  }

  const fontStack = mode.theme.fontFamily && mode.theme.fontFamily !== 'system' ? mode.theme.fontFamily : undefined

  return (
    <Stage accentColor={mode.theme.accentColor} fontFamily={fontStack}>
      <div className="ark-shell" ref={sceneRef}>
        {phase.name === 'resuming' ? (
          <section className="ark-scene ark-status-scene" aria-busy="true">
            <p className="ark-status-copy" role="status">
              Saddling up…
            </p>
          </section>
        ) : null}

        {phase.name === 'resume-error' ? (
          <section className="ark-scene ark-status-scene" aria-labelledby="ark-resume-error-heading">
            <div className="ark-status-card">
              <h2 id="ark-resume-error-heading" tabIndex={-1}>
                Your session could not be restored
              </h2>
              <p>{phase.message}</p>
              <div className="ark-status-actions">
                <button
                  type="button"
                  className="ark-btn ark-btn--primary"
                  onClick={() => {
                    setPhase({ name: 'resuming' })
                    setResumeAttempt((n) => n + 1)
                  }}
                >
                  Try again
                </button>
                <button
                  type="button"
                  className="ark-btn"
                  onClick={() => {
                    clearRunId(mode.slug)
                    setRun(null)
                    setPhase({ name: 'ready' })
                  }}
                >
                  Start a fresh run
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {phase.name === 'ready' ? renderScene() : null}

        {answerError ? (
          <p className="ark-error-banner" role="alert">
            {answerError}
          </p>
        ) : null}
      </div>
    </Stage>
  )
}
