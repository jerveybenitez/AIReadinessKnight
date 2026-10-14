/**
 * The indeterminate wait spinner (QODER.md §3.8 table, M14(e)) — for waits of unknown length
 * (the QWEN report), where a determinate bar would have to lie. Pure CSS ring in the accent
 * colour; DECORATIVE — the words in the adjoining status line carry the meaning, so this is
 * aria-hidden. Reduced motion collapses the spin via the global game.css rule.
 */
export function LoadingSpinner() {
  return <span className="ark-spinner" aria-hidden="true" />
}
