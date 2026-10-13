import type { Ref } from 'react'

import { assetOr } from '../assets'
import { Sprite } from './Sprite'
import type { TargetPoses } from '../types'

/**
 * One target in the row — a real <button> whose accessible name is the option text (the score
 * badge is aria-hidden). All three skin states (idle / hover / hit) come from the mode; the
 * impact overlay and the stuck projectile are separate slots so the scene can choreograph them.
 */

export type TargetPose = 'idle' | 'hover' | 'hit'

const TONES: Record<TargetPose, 'target-idle' | 'target-hover' | 'target-hit'> = {
  idle: 'target-idle',
  hover: 'target-hover',
  hit: 'target-hit',
}

export interface TargetProps {
  score: number
  text: string
  poses: TargetPoses
  pose: TargetPose
  selected: boolean
  disabled: boolean
  /** Show the hit pose as a delayed CSS overlay (the attack choreography is timed by the scene). */
  impactOverlay: boolean
  /** Impact frames at the moment of the hit (fire, shockwave — a CMS slot). */
  impactEffect: string | null
  /** Draw the projectile lodged in this target (static revisit of an already-answered question). */
  stuckProjectile: string | null
  showStuckProjectile: boolean
  ref?: Ref<HTMLButtonElement>
  onEnter: () => void
  onLeave: () => void
  onFocus: () => void
  onBlur: () => void
  onSelect: () => void
}

export function Target({
  score,
  text,
  poses,
  pose,
  selected,
  disabled,
  impactOverlay,
  impactEffect,
  stuckProjectile,
  showStuckProjectile,
  ref,
  onEnter,
  onLeave,
  onFocus,
  onBlur,
  onSelect,
}: TargetProps) {
  const poseUrl = poses[pose] ?? poses.idle
  return (
    <button
      ref={ref}
      type="button"
      className={`ark-target ark-target--${pose}${selected ? ' ark-target--selected' : ''}`}
      aria-label={text}
      aria-pressed={selected}
      disabled={disabled}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onSelect}
    >
      <Sprite asset={assetOr(poseUrl, `Target ${pose}`, TONES[pose])} className="ark-target-sprite" />
      {impactOverlay ? (
        <span className="ark-target-impact" aria-hidden="true">
          <Sprite asset={assetOr(poses.hit ?? poseUrl, 'Target hit', 'target-hit')} className="ark-target-hit" />
          {impactEffect ? (
            <Sprite asset={assetOr(impactEffect, 'Impact', 'effect')} className="ark-target-effect" />
          ) : null}
        </span>
      ) : null}
      {showStuckProjectile ? (
        <Sprite asset={assetOr(stuckProjectile, 'Projectile', 'effect')} className="ark-target-projectile" />
      ) : null}
      <span className="ark-target-score" aria-hidden="true">
        {score}
      </span>
    </button>
  )
}
