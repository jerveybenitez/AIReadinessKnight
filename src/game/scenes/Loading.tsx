import type { ResolvedMode } from '../types'

/**
 * The loading screen (QODER.md §3.8, M14) — the one scene that must never wait on the assets it
 * accompanies. Everything here is pure CSS or inline SVG in the mode's accent colour: no sprite
 * from the set being fetched, no generated asset. The bar fills on real request completions fed
 * by GameShell; the count is visual-only because the progressbar role carries the value for AT.
 * Reduced motion collapses the bob and spin (game.css) while the bar still fills — that is
 * information, not decoration.
 */

export interface LoadingSceneProps {
  mode: ResolvedMode
  done: number
  total: number
}

export function LoadingScene({ mode, done, total }: LoadingSceneProps) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <section className="ark-scene ark-loading-scene" aria-labelledby="ark-loading-heading">
      <div className="ark-loading-inner">
        <svg className="ark-loading-helm" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle
            className="ark-loading-ring"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--ark-accent)"
            strokeOpacity="0.3"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="72 255"
          />
          <g fill="var(--ark-accent)">
            <path d="M60 30c-15 0-25 10-25 24v20h50V54c0-14-10-24-25-24z" />
            <path d="M60 16c7 0 12 2.6 15.4 7.2C71 21.4 65.9 20.4 60 20.4s-11 1-15.4 3C48 18.6 53 16 60 16z" fillOpacity="0.75" />
          </g>
          <rect x="41" y="54" width="38" height="7" rx="3.5" fill="#14141f" />
          <rect x="57" y="61" width="6" height="15" rx="3" fill="#14141f" />
        </svg>

        <h2 id="ark-loading-heading" tabIndex={-1}>
          Loading the training grounds
        </h2>
        <p className="ark-loading-copy">Preparing the {mode.title} grounds…</p>

        <div
          className="ark-loading-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.max(total, 1)}
          aria-valuenow={done}
          aria-label="Training grounds loading progress"
        >
          <div className="ark-loading-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="ark-loading-count" aria-hidden="true">
          {done} / {total}
        </p>
      </div>
    </section>
  )
}
