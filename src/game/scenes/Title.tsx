'use client'

import { assetOr } from '../assets'
import { Sprite } from '../components/Sprite'
import type { ResolvedMode } from '../types'

export interface TitleSceneProps {
  mode: ResolvedMode
  onStart: () => void
}

export function TitleScene({ mode, onStart }: TitleSceneProps) {
  return (
    <section className="ark-scene ark-title-scene" aria-labelledby="ark-title-heading">
      <div className="ark-scene-bg">
        <Sprite asset={assetOr(mode.titleScreen.background, 'Title background', 'background')} className="ark-bg-fill" />
      </div>

      <div className="ark-title-card">
        <Sprite
          asset={assetOr(mode.titleScreen.logo, 'Logo', 'ui')}
          className="ark-title-logo"
          alt={`${mode.title} logo`}
        />
        <h1 id="ark-title-heading" tabIndex={-1}>
          {mode.title}
        </h1>
        {mode.titleScreen.copy ? <p className="ark-title-copy">{mode.titleScreen.copy}</p> : null}
        <button type="button" className="ark-btn ark-btn--primary ark-title-start" onClick={onStart}>
          Begin training
        </button>
      </div>

      <footer className="ark-title-foot">
        {mode.sections.map((section) => (
          <span key={section.key} className="ark-title-section" title={section.description}>
            <span aria-hidden="true">{section.icon || '◆'}</span> {section.name}
          </span>
        ))}
      </footer>
    </section>
  )
}
