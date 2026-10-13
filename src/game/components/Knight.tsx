import { assetOr } from '../assets'
import { Sprite } from './Sprite'
import type { KnightPoses } from '../types'

/**
 * The section's knight. Pose slots come resolved from the mode; a missing pose falls back to the
 * idle pose, and a missing idle pose to the dev placeholder — the two-step pick happens here once,
 * components never branch on URLs themselves.
 */

export type KnightPose = 'idle' | 'attack' | 'celebrate' | 'fail'

export interface KnightProps {
  poses: KnightPoses
  pose: KnightPose
  className?: string
}

const LABELS: Record<KnightPose, string> = {
  idle: 'Knight idle',
  attack: 'Knight attack',
  celebrate: 'Knight celebrates',
  fail: 'Knight fails',
}

export function Knight({ poses, pose, className }: KnightProps) {
  const url = poses[pose] ?? poses.idle
  return (
    <div className={className ? `ark-knight ${className}` : 'ark-knight'} data-pose={pose}>
      <Sprite asset={assetOr(url, LABELS[pose], 'knight')} className="ark-knight-sprite" />
    </div>
  )
}
