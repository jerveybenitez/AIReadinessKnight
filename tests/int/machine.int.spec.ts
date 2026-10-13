import { describe, expect, it } from 'vitest'

import {
  canAdvance,
  canGoBack,
  hydrate,
  initialState,
  progressOf,
  reduce,
  sceneForAnswers,
  type SectionShape,
} from '@/game/machine'
import type { Answer } from '@/game/types'

const ids = (key: string) => [1, 2, 3, 4, 5].map((n) => `${key}-q${n}`)

const sections: SectionShape[] = [
  { key: 'archery', questionIds: ids('archery') },
  { key: 'boxing', questionIds: ids('boxing') },
  { key: 'swordsmanship', questionIds: ids('swordsmanship') },
]

const answer = (questionId: string, optionIndex = 1): Answer => ({
  questionId,
  sectionKey: 'archery',
  optionIndex,
  score: optionIndex,
})

/** Play through the given question ids in order, answering each with option 1 (stepping over section ends). */
const playThrough = (questionIds: string[]) => {
  let state = reduce(initialState(), { type: 'START' }, sections)
  state = reduce(state, { type: 'INTAKE_DONE' }, sections)
  for (const id of questionIds) {
    if (state.scene.name === 'sectionEnd') state = reduce(state, { type: 'ADVANCE' }, sections)
    state = reduce(state, { type: 'ANSWER', answer: answer(id) }, sections)
    state = reduce(state, { type: 'ADVANCE' }, sections)
  }
  return state
}

describe('scene machine', () => {
  it('starts at the title and only START opens intake', () => {
    const state = initialState()
    expect(state.scene).toEqual({ name: 'title' })
    expect(reduce(state, { type: 'ADVANCE' }, sections).scene).toEqual({ name: 'title' })
    expect(reduce(state, { type: 'INTAKE_DONE' }, sections).scene).toEqual({ name: 'title' })
    expect(reduce(state, { type: 'START' }, sections).scene).toEqual({ name: 'intake' })
  })

  it('INTAKE_DONE lands on the frontier (first question on a fresh run)', () => {
    const state = reduce(reduce(initialState(), { type: 'START' }, sections), { type: 'INTAKE_DONE' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 0 })
  })

  it('ignores an answer for a question that is not current', () => {
    let state = reduce(reduce(initialState(), { type: 'START' }, sections), { type: 'INTAKE_DONE' }, sections)
    state = reduce(state, { type: 'ANSWER', answer: answer('archery-q3') }, sections)
    expect(state.answers).toEqual({})
  })

  it('cannot advance past an unanswered question, can once answered', () => {
    let state = reduce(reduce(initialState(), { type: 'START' }, sections), { type: 'INTAKE_DONE' }, sections)
    expect(canAdvance(state, sections)).toBe(false)
    const stuck = reduce(state, { type: 'ADVANCE' }, sections)
    expect(stuck.scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 0 })

    state = reduce(state, { type: 'ANSWER', answer: answer('archery-q1') }, sections)
    expect(canAdvance(state, sections)).toBe(true)
    state = reduce(state, { type: 'ADVANCE' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 1 })
  })

  it('question 5 leads to the section end, which leads to the next section', () => {
    let state = playThrough(ids('archery'))
    expect(state.scene).toEqual({ name: 'sectionEnd', sectionIndex: 0 })
    expect(canAdvance(state, sections)).toBe(true)
    state = reduce(state, { type: 'ADVANCE' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 1, questionIndex: 0 })
  })

  it('the last section end reaches results only with all 15 answers', () => {
    const atLastSectionEnd = playThrough([...ids('archery'), ...ids('boxing'), ...ids('swordsmanship')])
    expect(atLastSectionEnd.scene).toEqual({ name: 'sectionEnd', sectionIndex: 2 })

    const complete = reduce(atLastSectionEnd, { type: 'ADVANCE' }, sections)
    expect(complete.scene).toEqual({ name: 'results' })
    expect(canAdvance(complete, sections)).toBe(false)
    expect(canGoBack(complete)).toBe(false)
  })

  it('a section end can never enter results with a partial run — it re-derives the frontier', () => {
    const fourteen = [...ids('archery'), ...ids('boxing'), ...ids('swordsmanship').slice(0, 4)]
    const answers = Object.fromEntries(fourteen.map((id) => [id, answer(id)]))
    const partial = reduce(
      { scene: { name: 'sectionEnd', sectionIndex: 2 }, answers },
      { type: 'ADVANCE' },
      sections,
    )
    expect(partial.scene).toEqual({ name: 'question', sectionIndex: 2, questionIndex: 4 })
  })

  it('re-answering replaces the answer for the question id, never appends', () => {
    let state = reduce(reduce(initialState(), { type: 'START' }, sections), { type: 'INTAKE_DONE' }, sections)
    state = reduce(state, { type: 'ANSWER', answer: answer('archery-q1', 0) }, sections)
    state = reduce(state, { type: 'ANSWER', answer: answer('archery-q1', 4) }, sections)
    expect(Object.keys(state.answers)).toEqual(['archery-q1'])
    expect(state.answers['archery-q1'].optionIndex).toBe(4)
  })

  it('BACK walks to the previous question, across section boundaries, and stops at the start', () => {
    let state = playThrough([...ids('archery'), 'boxing-q1'])
    // Now on boxing q2. Back to boxing q1, then across the boundary to archery q5.
    expect(canGoBack(state)).toBe(true)
    state = reduce(state, { type: 'BACK' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 1, questionIndex: 0 })
    state = reduce(state, { type: 'BACK' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 4 })

    // Walk back to the very first question — BACK then has nowhere to go.
    for (let i = 0; i < 4; i++) state = reduce(state, { type: 'BACK' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 0 })
    expect(canGoBack(state)).toBe(false)
    expect(reduce(state, { type: 'BACK' }, sections).scene).toEqual({ name: 'question', sectionIndex: 0, questionIndex: 0 })
  })

  it('an answered question revisited still allows BACK and forward ADVANCE', () => {
    let state = playThrough([...ids('archery'), ...ids('boxing')])
    expect(state.scene).toEqual({ name: 'sectionEnd', sectionIndex: 1 })

    // Into the answered run: swordsmanship q1, then back into boxing q5.
    state = reduce(state, { type: 'ADVANCE' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 2, questionIndex: 0 })
    state = reduce(state, { type: 'BACK' }, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 1, questionIndex: 4 })
    expect(canAdvance(state, sections)).toBe(true)
    state = reduce(state, { type: 'ADVANCE' }, sections)
    expect(state.scene).toEqual({ name: 'sectionEnd', sectionIndex: 1 })
  })

  it('resume (hydrate) lands on the first unanswered question', () => {
    const answers = Object.fromEntries([...ids('archery'), 'boxing-q1'].map((id) => [id, answer(id)]))
    const state = hydrate(answers, sections)
    expect(state.scene).toEqual({ name: 'question', sectionIndex: 1, questionIndex: 1 })
  })

  it('resume with a complete run lands on results', () => {
    const answers = Object.fromEntries(
      [...ids('archery'), ...ids('boxing'), ...ids('swordsmanship')].map((id) => [id, answer(id)]),
    )
    expect(sceneForAnswers(answers, sections)).toEqual({ name: 'results' })
  })

  it('progressOf reports 1-based section and question only on the question scene', () => {
    expect(progressOf({ name: 'question', sectionIndex: 1, questionIndex: 2 })).toEqual({ section: 2, question: 3 })
    expect(progressOf({ name: 'sectionEnd', sectionIndex: 0 })).toBeNull()
    expect(progressOf({ name: 'title' })).toBeNull()
  })
})
