// Classic: Clawd blinks, glances down at the prompt and right at the bar,
// and taps a foot.

import { type ClawdLook, drawClawd } from '../clawd'
import { blinking, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

function awakeLook(t: number): Partial<ClawdLook> {
  const isTapping = t >= 5 && t < 6 && every(t, 0.25) % 2 === 1
  const look = t >= 2 && t < 3.5 ? { x: 0, y: 1 } : t >= 3.5 && t < 5 ? { x: 1, y: 0 } : { x: 0, y: 0 }

  return { pose: isTapping ? 'walk' : 'stand', stride: 1, isBlinking: blinking(t), look, arms: { left: 'down', right: 'down' } }
}

export const classic: IdleRoutine = { id: 'classic', loop: 8, still: 2, draw: (b, t) => drawClawd(b, CLAWD_X, 0, awakeLook(t)) }
