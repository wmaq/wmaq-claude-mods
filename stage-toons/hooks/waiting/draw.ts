// What the waiting scenes share: the helpers' colours and bodies, and what
// a scene is: what it draws under the helpers, each helper at its seat (and
// as it hops off), and over them. The shared code (index.ts) draws the
// walkers and Clawd aside with his cup.

import type { ModelKind } from '../agents'
import { CLAWD_ORANGE, EYE_DARK, FABLE_VIOLET, MONOCLE } from '../clawd'
import { type PixelBuffer, setPixel } from '../pixels'
import { drawSprite } from '../scene'
import { type Helper, type SeatLog, seatedAt } from './seats'

export const HELPER_COLORS: Record<ModelKind, number> = {
  sonnet: 0xe8559f,
  opus: CLAWD_ORANGE,
  fable: FABLE_VIOLET,
  haiku: 0x2bb3a8,
  unknown: 0xa3a3a3,
}

// A frame's moment: t, seconds into the waiting period; now, its time;
// the log; every helper on screen, and the seated ones in seat order.
export type WaitingCtx = { t: number; now: number; log: SeatLog; helpers: readonly Helper[]; seated: readonly Helper[] }

export type WaitingScene = {
  under?: (b: PixelBuffer, ctx: WaitingCtx) => void
  // A helper seated or hopping off its seat.
  helper: (b: PixelBuffer, h: Helper, ctx: WaitingCtx) => void
  over?: (b: PixelBuffer, ctx: WaitingCtx) => void
}

// How long a helper has been at its seat, in seconds (negative before it
// sits down), its work's clock; held at the moment it got up.
export const workTime = (h: Helper, now: number): number => (Math.min(now, h.entry.leftAt ?? Infinity) - seatedAt(h.entry)) / 1000

// A helper's body as it stands facing ahead, claws out at its sides: M body,
// E eyes. Five rows; the claws are the third row's ends.
export const STANDING = ['.MMMMM.', '.MEMEM.', 'MMMMMMM', '.MMMMM.', '.M...M.']
const CLAWLESS = ['.MMMMM.', '.MEMEM.', '.MMMMM.', '.MMMMM.', '.M...M.']
// Its body alone, sitting: three rows.
export const BODY = ['.MMMMM.', '.MEMEM.', '.MMMMM.']

// A helper standing at (x, y), in its colour, its claws out (the third
// row's ends), up (beside its eyes), down (on the fourth row) or left for
// the scene to draw; Fable's helper with its monocle.
export function drawStanding(b: PixelBuffer, h: Helper, x: number, y: number, claws: 'out' | 'up' | 'down' | 'none') {
  const color = HELPER_COLORS[h.entry.kind]
  drawSprite(b, { palette: { M: color, E: EYE_DARK }, frames: [claws === 'out' ? STANDING : CLAWLESS] }, 0, x, y)
  if (claws === 'up') {
    setPixel(b, x, y + 1, color)
    setPixel(b, x + 6, y + 1, color)
  }
  if (claws === 'down') {
    setPixel(b, x, y + 3, color)
    setPixel(b, x + 6, y + 3, color)
  }
  if (h.entry.kind === 'fable') setPixel(b, x + 5, y + 1, MONOCLE)
}

// A helper's sitting body at (x, y), its claws at its sides on its third row.
export function drawSitting(b: PixelBuffer, h: Helper, x: number, y: number) {
  const color = HELPER_COLORS[h.entry.kind]
  drawSprite(b, { palette: { M: color, E: EYE_DARK }, frames: [BODY] }, 0, x, y)
  setPixel(b, x, y + 2, color)
  setPixel(b, x + 6, y + 2, color)
  if (h.entry.kind === 'fable') setPixel(b, x + 5, y + 1, MONOCLE)
}
