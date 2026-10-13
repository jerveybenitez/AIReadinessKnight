'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { Stage } from './components/Stage'
import { canGoBack, initialState, reduce, type GameState, type GameEvent } from './machine'
import { clearRunId, createRun, fetchRun, readRunId, saveRunId, submitAnswer } from './run-client'
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
  const [actionFor, setActionFor] = useState<QuestionAction | null>(null)
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
        return <TitleScene mode={mode} onStart={() => dispatch({ type: 'START' })} />
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
