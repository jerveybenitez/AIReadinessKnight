'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { audioEngine } from '../audio/engine'
import { assetOr } from '../assets'
import { Knight } from '../components/Knight'
import { ProgressNav } from '../components/ProgressNav'
import { SpeechBubble } from '../components/SpeechBubble'
import { Sprite } from '../components/Sprite'
import { Target } from '../components/Target'
import { prefetchFromSection } from '../preload'
import type { Answer, ResolvedMode } from '../types'

/**
 * The question screen — one component, three skins (knight-game skill §"The question screen
 * contract"). Section identity only changes props: assets, name, weapon and target poses all come
 * from the resolved mode.
 *
 * Layout (fixed 1280×720 stage, coordinates below are stage pixels):
 * - top band: question text; on hover/focus the speech bubble replaces it, tail pointing at the
 *   hovered target — pointer hover and keyboard focus feed the same state;
 * - middle: 5 targets, score 0→4 left→right, each a real <button> named by its option text;
 * - bottom: knight (section weapon) and the progress bar with prev/next.
 *
 * The attack choreography (knight pose → projectile flight → impact → brief pause → advance) is a
 * pure visual consequence of the recorded answer. Game state advanced the moment the answer was
 * stored; this scene finishes the visual on a timer that always resolves, and any click or key
 * press during playback skips straight to the same final state. Reduced motion skips playback
 * entirely. The machine can never strand on an animation (skill failure mode #3).
 */

export interface QuestionAction {
  questionId: string
  optionIndex: number
}

export interface QuestionSceneProps {
  mode: ResolvedMode
  sectionIndex: number
  questionIndex: number
  answered?: Answer
  /** A server write is in flight — options locked. */
  pending: boolean
  /** A just-recorded answer to animate for the current question; null on revisits/resume. */
  action: QuestionAction | null
  reducedMotion: boolean
  onAnswer: (optionIndex: number) => void
  onActionComplete: () => void
  onBack: () => void
  onAdvance: () => void
  canGoBack: boolean
}

// --- stage geometry (fixed stage, so these are layout constants) ------------------------------

const ROW_LEFT = 70
const ROW_RIGHT = 70
const TARGET_SIZE = 200
const TARGET_GAP = 35
const TARGET_TOP = 198
const ROW_WIDTH = 1280 - ROW_LEFT - ROW_RIGHT
const BOW = { x: 452, y: 470 }

const targetCenterX = (index: number) => ROW_LEFT + TARGET_SIZE / 2 + index * (TARGET_SIZE + TARGET_GAP)
const TARGET_CENTER_Y = TARGET_TOP + TARGET_SIZE / 2

const FLIGHT_MS = 380
const IMPACT_HOLD_MS = 320
const TOTAL_MS = FLIGHT_MS + IMPACT_HOLD_MS

const tailPercentFor = (index: number) => ((targetCenterX(index) - ROW_LEFT) / ROW_WIDTH) * 100

export function QuestionScene({
  mode,
  sectionIndex,
  questionIndex,
  answered,
  pending,
  action,
  reducedMotion,
  onAnswer,
  onActionComplete,
  onBack,
  onAdvance,
  canGoBack,
}: QuestionSceneProps) {
  const section = mode.sections[sectionIndex]
  const question = section?.questions[questionIndex]
  const questionId = question?.id

  const [pointer, setPointer] = useState<{ qid: string; index: number } | null>(null)
  const [focus, setFocus] = useState<{ qid: string; index: number } | null>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  const attacking = Boolean(action && questionId && action.questionId === questionId)
  const actionTarget = attacking ? action!.optionIndex : null
  const chosenIndex = answered?.optionIndex ?? null
  const hoveredIndex =
    (pointer?.qid === questionId ? pointer.index : null) ?? (focus?.qid === questionId ? focus.index : null)

  // One music bed for all three sections (QODER.md M13): requested on every question mount,
  // a no-op when it is already playing.
  useEffect(() => {
    audioEngine.setMusic('music-gameplay')
  }, [])

  // M14(d): the rest of the mode arrives while the player answers — this section's end-beat
  // extras plus every later section (results join during the last). Idempotent; a resumed run
  // landing mid-mode prefetches from wherever the player actually is.
  useEffect(() => {
    prefetchFromSection(mode, sectionIndex)
  }, [mode, sectionIndex])

  // The attack beat, in sound: section attack cue when the choreography starts, the impact
  // exactly at the projectile's landing moment (the same FLIGHT_MS the CSS uses, ADR 0003), and
  // both are skipped when the visual beat itself is skipped under reduced motion. Audio is a
  // pure consequence — the always-resolving completion timer below owns the advance.
  useEffect(() => {
    if (!attacking || reducedMotion) return
    audioEngine.play('attack', { section: section?.key })
    const impactTimer = window.setTimeout(() => audioEngine.play('impact'), FLIGHT_MS)
    return () => window.clearTimeout(impactTimer)
  }, [attacking, reducedMotion, section])

  // Completion: one timer that always resolves + an any-key skip; reduced motion advances at once.
  const finishRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!attacking) return
    const finish = () => {
      if (finishRef.current !== finish) return
      finishRef.current = null
      onActionComplete()
    }
    finishRef.current = finish
    if (reducedMotion) {
      finish()
      return
    }
    const timer = setTimeout(finish, TOTAL_MS)
    const onKey = () => finish()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      if (finishRef.current === finish) finishRef.current = null
    }
  }, [attacking, reducedMotion, onActionComplete])

  const skip = useCallback(() => finishRef.current?.(), [])

  // Arrow keys reach the row even when focus is outside the scene (stray click on the board):
  // the section-level handler owns navigation once focus is inside, so this only covers the rest.
  const optionCount = question?.options.length ?? 0
  useEffect(() => {
    if (optionCount === 0) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
      if (step === 0) return
      if (optionRefs.current.some((el) => el === document.activeElement)) return
      event.preventDefault()
      optionRefs.current[step > 0 ? 0 : optionCount - 1]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [optionCount])

  if (!section || !question || !questionId) {
    return (
      <section className="ark-scene" aria-labelledby="ark-question-heading">
        <h2 id="ark-question-heading" tabIndex={-1}>
          This question is missing from the mode.
        </h2>
      </section>
    )
  }

  const isLastOfSection = questionIndex === section.questions.length - 1
  const busy = pending || attacking

  const bubble = attacking && actionTarget !== null
    ? { text: question.options[actionTarget]?.text ?? '', target: actionTarget }
    : hoveredIndex !== null
      ? { text: question.options[hoveredIndex]?.text ?? '', target: hoveredIndex }
      : null

  const onOptionsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const count = question.options.length
    const current = optionRefs.current.findIndex((el) => el === document.activeElement)
    // Focus may be on the heading or the nav: first arrow press lands on the row (from the right
    // edge when stepping backwards).
    const next = current === -1 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count
    optionRefs.current[next]?.focus()
  }

  const angleToTarget = (index: number) =>
    (Math.atan2(TARGET_CENTER_Y - BOW.y, targetCenterX(index) - BOW.x) * 180) / Math.PI

  return (
    <section
      className="ark-scene ark-question-scene"
      aria-labelledby="ark-question-heading"
      aria-busy={busy}
      onKeyDown={onOptionsKeyDown}
      style={attacking ? ({ '--ark-impact-delay': `${FLIGHT_MS}ms` } as CSSProperties) : undefined}
    >
      <div className="ark-scene-bg">
        <Sprite asset={assetOr(section.assets.background, `${section.name} background`, 'background')} className="ark-bg-fill" />
      </div>

      <div className="ark-q-banner" data-hidden={bubble ? 'true' : undefined}>
        <h2 id="ark-question-heading" tabIndex={-1}>
          {question.text}
        </h2>
      </div>

      {bubble ? <SpeechBubble text={bubble.text} tailPercent={tailPercentFor(bubble.target)} /> : null}

      <div className="ark-targets" role="group" aria-label="Answer options">
        {question.options.map((option, index) => {
          const isActionTarget = attacking && actionTarget === index
          const pose = isActionTarget || hoveredIndex === index ? 'hover' : chosenIndex === index ? 'hit' : 'idle'
          return (
            <Target
              key={option.text}
              ref={(el) => {
                optionRefs.current[index] = el
              }}
              score={option.score}
              text={option.text}
              poses={section.assets.target}
              pose={pose}
              selected={chosenIndex === index}
              disabled={busy}
              impactOverlay={isActionTarget}
              impactEffect={section.assets.hitEffect}
              stuckProjectile={section.assets.projectile}
              showStuckProjectile={chosenIndex === index && !attacking && Boolean(section.assets.projectile)}
              onEnter={() => {
                setPointer({ qid: questionId, index })
                audioEngine.play('ui-hover')
              }}
              onLeave={() => setPointer((p) => (p?.qid === questionId && p.index === index ? null : p))}
              onFocus={() => {
                // Keyboard focus outranks a resting pointer: the newest interaction wins the bubble.
                setFocus({ qid: questionId, index })
                setPointer(null)
                audioEngine.play('ui-hover')
              }}
              onBlur={() => setFocus((f) => (f?.qid === questionId && f.index === index ? null : f))}
              onSelect={() => onAnswer(index)}
            />
          )
        })}
      </div>

      {/* Ranged sections fly the projectile; melee sections (no projectile slot) let the attack
          pose + delayed impact overlay carry the beat — nothing flies, nothing sticks. */}
      {attacking && actionTarget !== null && !reducedMotion && Boolean(section.assets.projectile) ? (
        <span
          className="ark-arrow"
          aria-hidden="true"
          style={
            {
              left: `${BOW.x}px`,
              top: `${BOW.y}px`,
              '--ark-dx': `${targetCenterX(actionTarget) - BOW.x}px`,
              '--ark-dy': `${TARGET_CENTER_Y - BOW.y}px`,
              '--ark-ang': `${angleToTarget(actionTarget)}deg`,
            } as CSSProperties
          }
        >
          <Sprite asset={assetOr(section.assets.projectile, 'Projectile', 'effect')} className="ark-arrow-sprite" />
        </span>
      ) : null}

      <Knight poses={section.assets.knight} pose={attacking ? 'attack' : 'idle'} className="ark-knight-scene" />

      {attacking && !reducedMotion ? (
        <div className="ark-attack-skip" onClick={skip} aria-hidden="true" />
      ) : null}

      {pending ? (
        <p className="ark-question-status" role="status">
          Recording your answer…
        </p>
      ) : null}

      <ProgressNav
        sectionName={section.name}
        questionNumber={questionIndex + 1}
        questionsInSection={section.questions.length}
        sectionNumber={sectionIndex + 1}
        sectionsTotal={mode.sections.length}
        nextLabel={isLastOfSection ? 'Complete section →' : 'Next →'}
        canBack={canGoBack}
        canNext={Boolean(answered)}
        busy={busy}
        onBack={onBack}
        onNext={onAdvance}
      />
    </section>
  )
}
