import type { FinalBandKey, SectionBandKey, SectionKey } from './constants'

/**
 * The readiness report — the fixed shape QWEN must return, its validator, and the deterministic
 * fallback (qwen-report skill: "build this first").
 *
 * Pure: no Payload, network, React or DOM. The model's output is untrusted data; everything that
 * reaches a component has either passed `validateReport` or was built here. Text caps exist so an
 * over-enthusiastic model cannot ship a wall of prose into a fixed 1280×720 stage.
 */

export const REPORT_HORIZONS = ['now', '90-days', '12-months'] as const
export type ReportHorizon = (typeof REPORT_HORIZONS)[number]

export interface ReportNextStep {
  title: string
  detail: string
  horizon: ReportHorizon
}

export interface Report {
  headline: string
  summary: string
  strengths: string[]
  gaps: string[]
  nextSteps: ReportNextStep[]
}

/** What the client stores after a generation: the report plus how it was produced. */
export interface ReportState {
  status: 'ready' | 'fallback'
  report: Report
}

const asText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return null
  return trimmed
}

/**
 * Validate a list of strings. Every present item must be valid text; the list is clamped to
 * `maxItems` (an honest over-delivery is trimmed, not rejected). Empty lists are allowed —
 * an all-weak company has no strengths, and hiding that would be editorialising.
 */
const asTextList = (value: unknown, maxItems: number, maxLen: number): string[] | null => {
  if (!Array.isArray(value)) return null
  const items: string[] = []
  for (const item of value) {
    const text = asText(item, maxLen)
    if (!text) return null
    items.push(text)
  }
  return items.slice(0, maxItems)
}

const asNextSteps = (value: unknown): ReportNextStep[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const steps: ReportNextStep[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const record = entry as Record<string, unknown>
    const title = asText(record.title, 120)
    const detail = asText(record.detail, 600)
    const horizon = REPORT_HORIZONS.find((candidate) => candidate === record.horizon)
    if (!title || !detail || !horizon) return null
    steps.push({ title, detail, horizon })
  }
  return steps.slice(0, 5)
}

/**
 * Structural + safety validation, not editorial: the result is a fresh object carrying only the
 * known fields (whatever extras the model added are dropped). Null means "treat as an API
 * failure" — the caller falls back to `fallbackReport`.
 */
export function validateReport(value: unknown): Report | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  const headline = asText(record.headline, 200)
  const summary = asText(record.summary, 1200)
  const strengths = asTextList(record.strengths, 3, 400)
  const gaps = asTextList(record.gaps, 3, 400)
  const nextSteps = asNextSteps(record.nextSteps)

  if (!headline || !summary || !strengths || !gaps || !nextSteps) return null
  return { headline, summary, strengths, gaps, nextSteps }
}

// --- the deterministic fallback ----------------------------------------------------------------

export interface ReportSectionInput {
  key: SectionKey
  name: string
  mean: number
  band: SectionBandKey
}

export interface ReportInput {
  companyName: string
  industry: string
  sections: ReportSectionInput[]
  finalMean: number
  finalBand: FinalBandKey
}

const SECTION_GAP_PHRASE: Record<SectionBandKey, string> = {
  '0-0.9': 'little or no practice yet',
  '1-2.9': 'partial practice, not yet consistent',
  '3-4': 'strong — keep it there',
}

/** Weakest first; ties keep canonical order (stable sort). */
const byMeanAscending = (sections: ReportSectionInput[]): ReportSectionInput[] =>
  [...sections].sort((a, b) => a.mean - b.mean)

interface BandCopy {
  headline: (company: string) => string
  summary: (company: string, mean: string, industryPhrase: string) => string
  nextSteps: (weakest: ReportSectionInput, second: ReportSectionInput) => ReportNextStep[]
}

const BAND_COPY: Record<FinalBandKey, BandCopy> = {
  high_average: {
    headline: (company) => `${company} is among the AI-ready — foundations in place`,
    summary: (company, mean, industryPhrase) =>
      `${company} scored ${mean}/4${industryPhrase} — the strongest signal in this assessment. AI practice is working in most disciplines; the work ahead is to consolidate it, prove returns and keep the one weaker area from becoming a bottleneck.`,
    nextSteps: (weakest) => [
      {
        title: 'Close the last gap',
        detail: `${weakest.name} is the one area below strength (${weakest.mean.toFixed(1)}/4). A focused quarter there protects the whole programme.`,
        horizon: 'now',
      },
      {
        title: 'Institutionalise the practice',
        detail:
          'Turn the working methods into onboarding material and written standards, so growth in headcount does not dilute the practice.',
        horizon: '90-days',
      },
      {
        title: 'Prove returns at board level',
        detail:
          'Consolidate the measured wins into one return-on-investment story that justifies the next funding cycle.',
        horizon: '90-days',
      },
      {
        title: 'Stay hungry',
        detail:
          'Re-assess every quarter; treat a slipping section as an early warning, not a rounding error.',
        horizon: '12-months',
      },
    ],
  },
  average: {
    headline: (company) => `${company}: solid foundations, uneven execution`,
    summary: (company, mean, industryPhrase) =>
      `${company} scored ${mean}/4${industryPhrase}. There is real AI ambition and some working practice, but it is uneven across disciplines — the organisation is one focused quarter away from a stronger position, and one quarter of drift away from stagnation.`,
    nextSteps: (weakest, second) => [
      {
        title: 'Lift the weakest discipline',
        detail: `${weakest.name} trails the rest (${weakest.mean.toFixed(1)}/4). Name an owner and a 90-day target for it before starting anything new.`,
        horizon: 'now',
      },
      {
        title: 'Turn scattered practice into standards',
        detail: `Codify what already works in the stronger sections so ${second.name} can borrow it instead of improvising.`,
        horizon: '90-days',
      },
      {
        title: 'Prove one measurable return',
        detail:
          'Attach a hard metric — hours saved, cycle time, conversion — to the most mature AI use case and report it to leadership.',
        horizon: '90-days',
      },
      {
        title: 'Scale what passes the test',
        detail: 'Expand only the use cases whose metrics held for two quarters; retire the rest without sentiment.',
        horizon: '12-months',
      },
    ],
  },
  low_average: {
    headline: (company) => `${company}: early days — the foundations come first`,
    summary: (company, mean, industryPhrase) =>
      `${company} scored ${mean}/4${industryPhrase}. AI adoption here is still mostly intention rather than practice. That is a common starting point; the priority is to pick a single, concrete use case and build the habits that make it succeed.`,
    nextSteps: (weakest, second) => [
      {
        title: 'Pick one flagship use case',
        detail: `Choose a single candidate in ${weakest.name} with a visible business owner and a measurable outcome. Resist spreading effort across many pilots.`,
        horizon: 'now',
      },
      {
        title: 'Run a 90-day foundation sprint',
        detail: `In ${second.name}, build the basics — data access, tooling and a small delivery group — against that one flagship use case.`,
        horizon: '90-days',
      },
      {
        title: 'Start AI literacy where it hurts most',
        detail: `Give the teams nearest to ${weakest.name} a short, practical literacy programme, so the foundations are shared rather than held by one enthusiast.`,
        horizon: '90-days',
      },
      {
        title: 'Set a quarterly truth habit',
        detail:
          "Re-run this readiness assessment every quarter and let the weakest score drive the next quarter's agenda.",
        horizon: '12-months',
      },
    ],
  },
}

/**
 * The always-available report: built purely from the scores and bands, no network. This is the
 * default experience locally (qwen-report skill) and the degradation path in production — it must
 * read as a real report, never as an error message.
 */
export function fallbackReport(input: ReportInput): Report {
  const band = BAND_COPY[input.finalBand]
  const ordered = byMeanAscending(input.sections)
  const weakest = ordered[0]
  const second = ordered[1] ?? ordered[0]
  const industryPhrase = input.industry ? ` in the ${input.industry} space` : ''

  const strengths = input.sections
    .filter((section) => section.band === '3-4')
    .sort((a, b) => b.mean - a.mean)
    .map((section) => `${section.name} — ${section.mean.toFixed(1)}/4: working practice, worth protecting and extending.`)

  const gaps = ordered
    .filter((section) => section.band !== '3-4')
    .map((section) => `${section.name} — ${section.mean.toFixed(1)}/4 (${section.band}): ${SECTION_GAP_PHRASE[section.band]}.`)

  return {
    headline: band.headline(input.companyName),
    summary: band.summary(input.companyName, input.finalMean.toFixed(1), industryPhrase),
    strengths,
    gaps,
    nextSteps: band.nextSteps(weakest, second),
  }
}
