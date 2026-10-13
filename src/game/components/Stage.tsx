'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * The fixed 1280×720 logical stage (game-assets / knight-game skill).
 *
 * - Landscape only: the stage is scaled to fit the viewport with a measured factor — 100vw/1280
 *   is a length, not a number, so it cannot drive `scale()` in pure CSS.
 * - The stage stays `visibility: hidden` until the first measurement so there is no flash at
 *   scale 1, and hydration always matches (the server renders the unmeasured state).
 * - There is no portrait layout; a portrait viewport gets the rotate-to-play overlay (game.css).
 * - Theme values (accent colour, font) arrive as CSS custom properties so every scene inherits
 *   them without threading style props through component trees.
 */

export const STAGE_WIDTH = 1280
export const STAGE_HEIGHT = 720

export interface StageProps {
  children: ReactNode
  accentColor?: string
  /** A CSS font-family stack, or undefined for the built-in default. */
  fontFamily?: string
}

export function Stage({ children, accentColor, fontFamily }: StageProps) {
  const [scale, setScale] = useState<number | null>(null)

  useEffect(() => {
    const measure = () => {
      setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  const style: CSSProperties = {}
  if (accentColor) (style as Record<string, string>)['--ark-accent'] = accentColor
  if (fontFamily) (style as Record<string, string>)['--ark-font'] = fontFamily

  return (
    <div className="ark-viewport" style={style}>
      <div className="ark-rotate">
        <div className="ark-rotate-card">
          <p className="ark-rotate-icon" aria-hidden="true">
            ⟳
          </p>
          <p>Rotate your device to play.</p>
          <p className="ark-rotate-hint">Knight training is landscape only.</p>
        </div>
      </div>
      <div
        className="ark-stage"
        style={{
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          visibility: scale === null ? 'hidden' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
