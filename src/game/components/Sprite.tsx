import type { RenderableAsset } from '../assets'

/**
 * Renders a RenderableAsset — the output of the single `assetOr` resolver (src/game/assets.ts).
 * Components never branch on missing URLs themselves: they build the descriptor and hand it here.
 * Placeholders are labelled, toned blocks so missing art is legible during development instead of
 * silently invisible.
 */

export interface SpriteProps {
  asset: RenderableAsset
  className?: string
  /** Alt text for real images; placeholders always render their label visibly. */
  alt?: string
}

export function Sprite({ asset, className, alt = '' }: SpriteProps) {
  if (asset.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- CMS assets are arbitrary uploads; next/image optimisation is not part of the brief
    return <img src={asset.url} alt={alt} className={className} draggable={false} />
  }
  return (
    <div
      className={className ? `${className} ark-placeholder ark-placeholder--${asset.tone}` : `ark-placeholder ark-placeholder--${asset.tone}`}
      aria-hidden="true"
    >
      <span>{asset.label}</span>
    </div>
  )
}
