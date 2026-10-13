/**
 * Canonical game-domain keys, shared by CMS validation, seed, scoring and the frontend.
 * Pure constants only — no Payload, React or DOM imports (see knight-game skill).
 */

export const SECTION_KEYS = ['archery', 'boxing', 'swordsmanship'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

/** Section-end animation band keys — must match `section_animation` keys in ai_readiness_questions.json verbatim. */
export const SECTION_BAND_KEYS = ['0-0.9', '1-2.9', '3-4'] as const
export type SectionBandKey = (typeof SECTION_BAND_KEYS)[number]

/** Final knight-pose band keys — from `summary_pose` in ai_readiness_questions.json. A different set from the section bands. */
export const FINAL_BAND_KEYS = ['low_average', 'average', 'high_average'] as const
export type FinalBandKey = (typeof FINAL_BAND_KEYS)[number]

export const SECTIONS_PER_MODE = 3
export const QUESTIONS_PER_SECTION = 5
export const OPTIONS_PER_QUESTION = 5
export const MAX_ANSWERS = SECTIONS_PER_MODE * QUESTIONS_PER_SECTION

/** Slugs the game route must never shadow ((payload) owns /admin and /api; /result is the permalink namespace; _next is Next internals). */
export const RESERVED_MODE_SLUGS = ['admin', 'api', 'result', '_next'] as const
