'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { audioEngine } from '../audio/engine'
import type { ResolvedMode } from '../types'

export interface IntakeFields {
  knightName: string
  companyName: string
  industry: string
}

export interface IntakeSceneProps {
  mode: ResolvedMode
  /** Creates the run server-side, mirrors the runId locally, and moves the machine forward. */
  onDone: (fields: IntakeFields) => Promise<void>
}

const MAX_FIELD = 120

export function IntakeScene({ mode, onDone }: IntakeSceneProps) {
  const [knightName, setKnightName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Title and intake share the one intake bed (QODER.md M13); a no-op when already playing.
  useEffect(() => {
    audioEngine.setMusic('music-title')
  }, [])

  const ready = knightName.trim().length > 0 && companyName.trim().length > 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || pending) return
    setPending(true)
    setError(null)
    audioEngine.play('ui-select')
    try {
      await onDone({
        knightName: knightName.trim(),
        companyName: companyName.trim(),
        industry: industry.trim(),
      })
    } catch (cause) {
      audioEngine.play('ui-error')
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.')
      setPending(false)
    }
  }

  return (
    <section className="ark-scene ark-intake-scene" aria-labelledby="ark-intake-heading">
      <form className="ark-intake-card" onSubmit={submit}>
        <h2 id="ark-intake-heading" tabIndex={-1}>
          Knight intake
        </h2>
        <p className="ark-intake-lede">
          Your guide for the {mode.title} training grounds. Who is taking up the training today?
        </p>

        <label className="ark-field">
          <span>Knight name</span>
          <input
            value={knightName}
            onChange={(e) => setKnightName(e.target.value)}
            maxLength={MAX_FIELD}
            required
            autoComplete="name"
            autoFocus
          />
        </label>

        <label className="ark-field">
          <span>Company</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={MAX_FIELD}
            required
            autoComplete="organization"
          />
        </label>

        <label className="ark-field">
          <span>
            Industry <em>(optional)</em>
          </span>
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={MAX_FIELD} />
        </label>

        {error ? (
          <p className="ark-form-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="ark-btn ark-btn--primary" disabled={!ready || pending}>
          {pending ? 'Saddling up…' : 'Enter the training grounds'}
        </button>

        <p className="ark-privacy-note">
          Your answers are stored under your knight and company name so your report can be prepared. Your result link is
          shareable — anyone with it can view your scores.
        </p>
      </form>
    </section>
  )
}
