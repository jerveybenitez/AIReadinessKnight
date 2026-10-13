/**
 * The scene state machine — pure. No React, DOM or Payload imports.
 *
 * Rules (from the knight-game skill):
 * - The machine owns the current scene; components never render from local scene state.
 * - Transitions are explicit named events.
 * - Re-answering replaces the stored answer for a question id, never appends.
 * - Results requires all 15 answers; entering it any other way is a bug.
 * - BACK moves to the previous question in order (always an answered one when it exists);
 *   forward navigation never lands past the first unanswered question.
 */
import type { SectionKey } from './constants'
import type { Answer, AnswerMap } from './types'

export interface SectionShape {
  key: SectionKey
  questionIds: string[]
}

export type Scene =
  | { name: 'title' }
  | { name: 'intake' }
  | { name: 'question'; sectionIndex: number; questionIndex: number }
  | { name: 'sectionEnd'; sectionIndex: number }
  | { name: 'results' }

export type GameEvent =
  | { type: 'START' }
  | { type: 'INTAKE_DONE' }
  | { type: 'RESUME'; answers: AnswerMap }
  | { type: 'ANSWER'; answer: Answer }
  | { type: 'ADVANCE' }
  | { type: 'BACK' }

export interface GameState {
  scene: Scene
  answers: AnswerMap
}

export function initialState(): GameState {
  return { scene: { name: 'title' }, answers: {} }
}

const totalQuestions = (sections: SectionShape[]): number =>
  sections.reduce((n, s) => n + s.questionIds.length, 0)

/** The question the player should be on: the first unanswered, or results when the run is complete. */
export function sceneForAnswers(answers: AnswerMap, sections: SectionShape[]): Scene {
  for (let si = 0; si < sections.length; si++) {
    const ids = sections[si].questionIds
    for (let qi = 0; qi < ids.length; qi++) {
      if (!answers[ids[qi]]) {
        return { name: 'question', sectionIndex: si, questionIndex: qi }
      }
    }
  }
  return { name: 'results' }
}

/** Rebuild a state from persisted answers (refresh / reopen). */
export function hydrate(answers: AnswerMap, sections: SectionShape[]): GameState {
  return { scene: sceneForAnswers(answers, sections), answers }
}

function currentQuestionId(scene: Scene, sections: SectionShape[]): string | null {
  if (scene.name !== 'question') return null
  const section = sections[scene.sectionIndex]
  return section?.questionIds[scene.questionIndex] ?? null
}

export function reduce(state: GameState, event: GameEvent, sections: SectionShape[]): GameState {
  switch (event.type) {
    case 'START': {
      if (state.scene.name !== 'title') return state
      return { ...state, scene: { name: 'intake' } }
    }

    case 'INTAKE_DONE': {
      if (state.scene.name !== 'intake') return state
      return { ...state, scene: sceneForAnswers(state.answers, sections) }
    }

    case 'RESUME': {
      // Re-attach to a persisted run: rebuild answers and land on the frontier (or results).
      return hydrate(event.answers, sections)
    }

    case 'ANSWER': {
      if (state.scene.name !== 'question') return state
      const id = currentQuestionId(state.scene, sections)
      if (!id || event.answer.questionId !== id) return state
      // Replace, never append — a replay rewrites the single entry for this question id.
      return { ...state, answers: { ...state.answers, [id]: event.answer } }
    }

    case 'ADVANCE': {
      const scene = state.scene
      if (scene.name === 'question') {
        const id = currentQuestionId(scene, sections)
        if (!id || !state.answers[id]) return state // cannot leave an unanswered question forward
        const section = sections[scene.sectionIndex]
        if (scene.questionIndex + 1 < section.questionIds.length) {
          return { ...state, scene: { ...scene, questionIndex: scene.questionIndex + 1 } }
        }
        return { ...state, scene: { name: 'sectionEnd', sectionIndex: scene.sectionIndex } }
      }
      if (scene.name === 'sectionEnd') {
        const nextSection = scene.sectionIndex + 1
        const section = sections[nextSection]
        if (section && section.questionIds.length > 0) {
          return { ...state, scene: { name: 'question', sectionIndex: nextSection, questionIndex: 0 } }
        }
        // Only a fully answered run may reach results; otherwise re-derive the frontier.
        if (Object.keys(state.answers).length >= totalQuestions(sections)) {
          return { ...state, scene: { name: 'results' } }
        }
        return { ...state, scene: sceneForAnswers(state.answers, sections) }
      }
      return state
    }

    case 'BACK': {
      const scene = state.scene
      if (scene.name !== 'question') return state
      if (scene.questionIndex > 0) {
        return { ...state, scene: { ...scene, questionIndex: scene.questionIndex - 1 } }
      }
      const prevSection = scene.sectionIndex - 1
      const section = sections[prevSection]
      if (section && section.questionIds.length > 0) {
        return {
          ...state,
          scene: { name: 'question', sectionIndex: prevSection, questionIndex: section.questionIds.length - 1 },
        }
      }
      return state
    }
  }
}

/** Is BACK available from the current scene? (Question 1 of section 1 has nowhere to go.) */
export function canGoBack(state: GameState): boolean {
  const scene = state.scene
  if (scene.name !== 'question') return false
  return scene.sectionIndex > 0 || scene.questionIndex > 0
}

/** Is there a forward step? From a question only once it is answered; section-end always continues. */
export function canAdvance(state: GameState, sections: SectionShape[]): boolean {
  const scene = state.scene
  if (scene.name === 'question') {
    const id = currentQuestionId(scene, sections)
    return Boolean(id && state.answers[id])
  }
  return scene.name === 'sectionEnd'
}

/** The progress label shared by the whole run: "Q3 of 5 · Section 1 of 3". */
export function progressOf(scene: Scene): { question: number; section: number } | null {
  if (scene.name !== 'question') return null
  return { question: scene.questionIndex + 1, section: scene.sectionIndex + 1 }
}
