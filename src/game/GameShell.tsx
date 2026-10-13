'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { Stage } from './components/Stage'
import { canGoBack, initialState, reduce, type GameState, type GameEvent } from './machine'
import { clearRunId, createRun, fetchRun, readRunId, saveRunId, submitAnswer } from './run-client'
import { IntakeScene, type IntakeFields } from './scenes/Intake'
import { QuestionScene } from './scenes/Question'
import { ResultsScene } from './scenes/Results'
import { SectionEndScene } from './scenes/SectionEnd'
import { TitleScene } from './scenes/Title'
import type { Answer, AnswerMap, ResolvedMode, RunSnapshot } from './types'
import './game.css'

/**
 * The stage shell: owns the machine instance, the run pointer, and the server writes.
 * Everything about "where am I" lives in the machine (src/game/machine.ts); this component only
 * wires events to it and renders the resulting scene.
 */

interface RunMeta {
  runId: string
  knightName: string
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

/** The pause between a recorded answer and the automatic advance in M3 (M4 replaces it with the attack animation). */
const ADVANCE_BEAT_MS = 700

export function GameShell({ mode }: { mode: ResolvedMode }) {
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
  const [autoAdvanceId, setAutoAdvanceId] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  // Resume: re-attach to the run this session last wrote for this mode (ADR 0002).
  useEffect(() => {
    let cancelled = false
    const runId = readRunId(mode.slug)
    const attempt: Promise<RunSnapshot | null> = runId ? fetchRun(runId) : Promise.resolve(null)
    attempt
      .then((snapshot) => {
        if (cancelled) return
        if (!snapshot || snapshot.modeSlug !== mode.slug) {
          // Deleted run, or a run that belongs to another mode — start fresh.
          if (runId) clearRunId(mode.slug)
          setRun(null)
        } else {
          const answers: AnswerMap = {}
          for (const answer of snapshot.answers) answers[answer.questionId] = answer
          setRun({ runId: snapshot.runId, knightName: snapshot.knightName })
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
  }, [mode.slug, resumeAttempt])

  const handleIntakeDone = useCallback(
    async (fields: IntakeFields) => {
      const { runId } = await createRun({ modeSlug: mode.slug, ...fields })
      saveRunId(mode.slug, runId)
      setRun({ runId, knightName: fields.knightName })
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
        setAutoAdvanceId(question.id)
      } catch (cause) {
        setAnswerError(cause instanceof Error ? cause.message : 'Could not record your answer.')
      } finally {
        setPendingAnswer(false)
      }
    },
    [run, pendingAnswer, state.scene, mode.sections],
  )

  // The beat between a recorded answer and the advance — a visual consequence, never game state:
  // Continue during the beat lands in the same scene (skip path), reduced motion advances at once.
  // A stale id (scene moved on via Continue) simply never schedules — the guard below returns.
  useEffect(() => {
    if (!autoAdvanceId || state.scene.name !== 'question') return
    const currentId = sections[state.scene.sectionIndex]?.questionIds[state.scene.questionIndex]
    if (currentId !== autoAdvanceId) return
    const timer = setTimeout(
      () => {
        setAutoAdvanceId(null)
        dispatch({ type: 'ADVANCE' })
      },
      reducedMotion ? 0 : ADVANCE_BEAT_MS,
    )
    return () => clearTimeout(timer)
  }, [autoAdvanceId, state.scene, sections, reducedMotion])

  // Focus follows the scene: keyboard players land on the new screen's heading.
  const sceneRef = useRef<HTMLDivElement>(null)
  const sceneKey =
    state.scene.name === 'question'
      ? `question:${state.scene.sectionIndex}:${state.scene.questionIndex}`
      : state.scene.name
  useEffect(() => {
    if (phase.name !== 'ready') return
    sceneRef.current?.querySelector<HTMLElement>('h1, h2')?.focus()
  }, [sceneKey, phase.name])

  const advance = useCallback(() => {
    setAutoAdvanceId(null)
    setAnswerError(null)
    dispatch({ type: 'ADVANCE' })
  }, [])

  const goBack = useCallback(() => {
    setAutoAdvanceId(null)
    setAnswerError(null)
    dispatch({ type: 'BACK' })
  }, [])

  const renderScene = () => {
    const scene = state.scene
    switch (scene.name) {
      case 'title':
        return <TitleScene mode={mode} onStart={() => dispatch({ type: 'START' })} />
      case 'intake':
        return <IntakeScene mode={mode} onDone={handleIntakeDone} />
      case 'question': {
        const section = mode.sections[scene.sectionIndex]
        const question = section?.questions[scene.questionIndex]
        return (
          <QuestionScene
            mode={mode}
            sectionIndex={scene.sectionIndex}
            questionIndex={scene.questionIndex}
            answered={question ? state.answers[question.id] : undefined}
            pending={pendingAnswer}
            onAnswer={handleAnswer}
            onBack={goBack}
            onAdvance={advance}
            canGoBack={canGoBack(state)}
          />
        )
      }
      case 'sectionEnd':
        return <SectionEndScene mode={mode} sectionIndex={scene.sectionIndex} onContinue={advance} />
      case 'results':
        return (
          <ResultsScene
            mode={mode}
            knightName={run?.knightName ?? 'knight'}
            runId={run?.runId ?? ''}
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
