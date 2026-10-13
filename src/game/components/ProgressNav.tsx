/**
 * Bottom bar of the question screen: [← previous] · progress · [next →].
 * Buttons are real controls (keyboard reachable); disabled states are expressed, never hidden,
 * so the affordance stays visible on every question (QODER.md §3.1).
 */

export interface ProgressNavProps {
  sectionName: string
  questionNumber: number
  questionsInSection: number
  sectionNumber: number
  sectionsTotal: number
  nextLabel: string
  canBack: boolean
  canNext: boolean
  busy: boolean
  onBack: () => void
  onNext: () => void
}

export function ProgressNav({
  sectionName,
  questionNumber,
  questionsInSection,
  sectionNumber,
  sectionsTotal,
  nextLabel,
  canBack,
  canNext,
  busy,
  onBack,
  onNext,
}: ProgressNavProps) {
  return (
    <footer className="ark-question-nav">
      <button type="button" className="ark-btn" onClick={onBack} disabled={!canBack || busy}>
        ← Previous
      </button>
      <p className="ark-progress">
        <span className="ark-progress-chip">{sectionName}</span>
        <span>
          Question {questionNumber} of {questionsInSection} · Section {sectionNumber} of {sectionsTotal}
        </span>
      </p>
      <button type="button" className="ark-btn ark-btn--primary" onClick={onNext} disabled={!canNext || busy}>
        {nextLabel}
      </button>
    </footer>
  )
}
