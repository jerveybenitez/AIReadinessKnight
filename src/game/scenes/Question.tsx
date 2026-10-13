'use client'

import { useRef, type KeyboardEvent } from 'react'

import type { Answer, ResolvedMode } from '../types'

/**
 * The question screen — skeleton for M3. The full contract (targets, knight, speech bubbles,
 * attack animation) lands in M4; what is already load-bearing here:
 * - one component for all three sections, rendered purely from resolved mode data;
 * - options are real <button>s whose accessible name is the option text (score badge is hidden
 *   from assistive tech);
 * - arrow keys move between options; Enter/Space select (native button behaviour);
 * - an answered question shows its chosen option selected when revisited;
 * - Back is offered only when the machine allows it.
 */

export interface QuestionSceneProps {
  mode: ResolvedMode
  sectionIndex: number
  questionIndex: number
  answered?: Answer
  /** A server write is in flight — lock the options. */
  pending: boolean
  onAnswer: (optionIndex: number) => void
  onBack: () => void
  onAdvance: () => void
  canGoBack: boolean
}

export function QuestionScene({
  mode,
  sectionIndex,
  questionIndex,
  answered,
  pending,
  onAnswer,
  onBack,
  onAdvance,
  canGoBack,
}: QuestionSceneProps) {
  const section = mode.sections[sectionIndex]
  const question = section?.questions[questionIndex]
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (!section || !question) {
    // A resolved mode always has 3×5 questions (assertPlayable); this guards against a race in dev.
    return (
      <section className="ark-scene" aria-labelledby="ark-question-heading">
        <h2 id="ark-question-heading" tabIndex={-1}>
          This question is missing from the mode.
        </h2>
      </section>
    )
  }

  const selected = answered?.optionIndex
  const isLastOfSection = questionIndex === section.questions.length - 1

  const onOptionsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const count = question.options.length
    const current = optionRefs.current.findIndex((el) => el === document.activeElement)
    const next = current === -1 ? 0 : (current + step + count) % count
    optionRefs.current[next]?.focus()
  }

  return (
    <section className="ark-scene ark-question-scene" aria-labelledby="ark-question-heading">
      <header className="ark-question-head">
        <p className="ark-progress">
          <span className="ark-progress-chip">{section.name}</span>
          <span>
            Section {sectionIndex + 1} of {mode.sections.length} · Question {questionIndex + 1} of{' '}
            {section.questions.length}
          </span>
        </p>
        <h2 id="ark-question-heading" tabIndex={-1}>
          {question.text}
        </h2>
      </header>

      <div className="ark-options" role="group" aria-label="Answer options" onKeyDown={onOptionsKeyDown}>
        {question.options.map((option, index) => (
          <button
            key={option.text}
            ref={(el) => {
              optionRefs.current[index] = el
            }}
            type="button"
            className={`ark-option${selected === index ? ' ark-option--selected' : ''}`}
            onClick={() => onAnswer(index)}
            disabled={pending}
            aria-pressed={selected === index}
          >
            <span className="ark-option-score" aria-hidden="true">
              {option.score}
            </span>
            <span className="ark-option-text">{option.text}</span>
          </button>
        ))}
      </div>

      {pending ? (
        <p className="ark-question-status" role="status">
          Recording your answer…
        </p>
      ) : null}

      <footer className="ark-question-nav">
        {canGoBack ? (
          <button type="button" className="ark-btn" onClick={onBack} disabled={pending}>
            ← Previous question
          </button>
        ) : (
          <span />
        )}
        {answered ? (
          <button type="button" className="ark-btn ark-btn--primary" onClick={onAdvance} disabled={pending}>
            {isLastOfSection ? 'Complete this training' : 'Continue'} →
          </button>
        ) : null}
      </footer>
    </section>
  )
}
