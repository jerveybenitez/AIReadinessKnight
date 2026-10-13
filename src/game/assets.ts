/**
 * The single place a missing asset becomes a placeholder (game-assets skill).
 * Components never branch on `url ? ... : ...` themselves — they call `assetOr` and render the
 * returned descriptor through <Sprite>. When `default` art is generated (M8), placeholders stop
 * being reachable in /default automatically.
 */

export type PlaceholderTone =
  | 'background'
  | 'knight'
  | 'target-idle'
  | 'target-hover'
  | 'target-hit'
  | 'effect'
  | 'ui'

export type RenderableAsset =
  | { kind: 'image'; url: string }
  | { kind: 'placeholder'; label: string; tone: PlaceholderTone }

export function assetOr(url: string | null | undefined, label: string, tone: PlaceholderTone): RenderableAsset {
  if (url) return { kind: 'image', url }
  return { kind: 'placeholder', label, tone }
}
