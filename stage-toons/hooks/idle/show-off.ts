// Show-off: after a step is finished, Clawd holds up its prop beside him
// (the spec's scroll, the plan's checklist, ...), looks at it, lifts it,
// turns it over, then glances down at the prompt. Played once, in the first
// idle period after the move.

import type { StageId } from '../../types'
import { drawClawd } from '../clawd'
import { drawSprite } from '../scene'
import { blinking, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import { propOf } from './props'
import type { IdleRoutine } from './routine'

export const SHOW_OFF_PREFIX = 'show-off:'
const LOOP = 6
const BOX_H = 8

// The routine's id for a stage: it names the stage, so a hot reload keeps it.
export const showOffId = (stage: StageId): string => `${SHOW_OFF_PREFIX}${stage}`

export function showOff(stage: StageId): IdleRoutine {
  const prop = propOf(stage)
  const w = prop.frames[0]![0]!.length
  const h = prop.frames[0]!.length

  return {
    id: showOffId(stage),
    loop: LOOP,
    still: 2,
    draw: (b, t) => {
      const isRaised = t >= 1.5 && t < 3
      const isTurning = t >= 3 && t < 4.5
      const isGlancing = t >= 4.5
      const look = { isBlinking: blinking(t, 0.2), look: isGlancing ? { x: 0, y: 1 } : { x: -1, y: isRaised ? -1 : 0 } }
      const arms = { left: isRaised ? ('up' as const) : ('out' as const), right: 'down' as const }
      // The prop first, so the claw grips it: its top right corner at the
      // claw's tip (lifted two rows when raised), kept inside the box.
      const tip = isRaised ? { x: CLAWD_X, y: 0 } : { x: CLAWD_X - 2, y: 2 }
      const y = Math.max(0, Math.min(BOX_H - h, tip.y))
      drawSprite(b, prop, 0, tip.x - w + 1, y, isTurning && every(t, 0.4) % 2 === 1)
      drawClawd(b, CLAWD_X, 0, { ...look, arms })
    },
  }
}
