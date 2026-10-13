import { describe, expect, it } from 'vitest'

import { FINAL_BAND_KEYS, SECTION_BAND_KEYS } from '@/game/constants'
import { finalBand, finalBandOf, mean, sectionBand, sectionBandOf } from '@/game/scoring'

/**
 * §4 is settled law: every boundary is pinned here, including the fractional means that are not
 * reachable from five integer answers — they still must never be rounded into the next band.
 */

describe('mean', () => {
  it('averages scores without rounding', () => {
    expect(mean([0, 1, 2, 3, 4])).toBe(2)
    expect(mean([4, 4, 4, 4, 4])).toBe(4)
    expect(mean([2, 3])).toBe(2.5)
    expect(mean([0])).toBe(0)
    expect(mean([])).toBe(0)
  })
})

describe('sectionBand (>=3 → 3-4, >=1 → 1-2.9, else 0-0.9)', () => {
  it('pins every reachable boundary', () => {
    expect(sectionBandOf(0)).toBe('0-0.9')
    expect(sectionBandOf(0.9)).toBe('0-0.9')
    expect(sectionBandOf(1.0)).toBe('1-2.9')
    expect(sectionBandOf(2.5)).toBe('1-2.9')
    expect(sectionBandOf(2.9)).toBe('1-2.9')
    expect(sectionBandOf(2.95)).toBe('1-2.9')
    expect(sectionBandOf(3.0)).toBe('3-4')
    expect(sectionBandOf(4.0)).toBe('3-4')
  })

  it('bands real five-answer sections', () => {
    expect(sectionBand([0, 0, 0, 0, 0])).toBe('0-0.9')
    expect(sectionBand([4, 0, 0, 0, 0])).toBe('0-0.9') // mean 0.8
    expect(sectionBand([1, 1, 1, 1, 1])).toBe('1-2.9')
    expect(sectionBand([0, 1, 2, 3, 4])).toBe('1-2.9') // mean 2.0
    expect(sectionBand([3, 3, 3, 3, 2])).toBe('1-2.9') // mean 2.8 — rounding it to 3 would wrongly promote
    expect(sectionBand([3, 3, 3, 3, 3])).toBe('3-4')
    expect(sectionBand([4, 4, 4, 4, 4])).toBe('3-4')
  })
})

describe('finalBand (>=2.9 → high_average, >=1.7 → average, else low_average)', () => {
  it('pins the §4 boundary list exactly', () => {
    expect(finalBandOf(0)).toBe('low_average')
    expect(finalBandOf(0.9)).toBe('low_average')
    expect(finalBandOf(1.0)).toBe('low_average')
    expect(finalBandOf(1.6)).toBe('low_average')
    expect(finalBandOf(1.65)).toBe('low_average')
    expect(finalBandOf(1.7)).toBe('average')
    expect(finalBandOf(2.8)).toBe('average')
    expect(finalBandOf(2.85)).toBe('average')
    expect(finalBandOf(2.9)).toBe('high_average')
    expect(finalBandOf(2.95)).toBe('high_average')
    expect(finalBandOf(3.0)).toBe('high_average')
    expect(finalBandOf(4.0)).toBe('high_average')
  })

  it('bands real fifteen-answer runs', () => {
    expect(finalBand(Array.from({ length: 15 }, () => 0))).toBe('low_average')
    expect(finalBand(Array.from({ length: 15 }, () => 1))).toBe('low_average') // mean 1.0
    expect(finalBand([...Array(4).fill(2), ...Array(11).fill(1)])).toBe('low_average') // mean 1.27
    expect(finalBand(Array.from({ length: 15 }, () => 2))).toBe('average')
    expect(finalBand([...Array(13).fill(3), 2, 2])).toBe('average') // mean 2.87 — rounding to 2.9 would wrongly promote
    expect(finalBand([...Array(14).fill(3), 2])).toBe('high_average') // mean 2.93
    expect(finalBand(Array.from({ length: 15 }, () => 4))).toBe('high_average')
  })
})

describe('the two band sets stay distinct', () => {
  it('shares no keys between section and final bands', () => {
    for (const key of SECTION_BAND_KEYS) {
      expect(FINAL_BAND_KEYS as readonly string[]).not.toContain(key)
    }
    for (const key of FINAL_BAND_KEYS) {
      expect(SECTION_BAND_KEYS as readonly string[]).not.toContain(key)
    }
  })
})
