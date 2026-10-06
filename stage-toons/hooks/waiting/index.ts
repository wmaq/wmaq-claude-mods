// The waiting toon: while Claude waits on agents, Clawd stands aside with a
// cup and watches a row of helpers, one per agent at work, each in its
// model's colour, at one of the waiting scenes (WAITING_SCENES). 48 x 14
// pixels, drawn from the seat log, the scene and the time alone.

import { drawClawd, EYE_DARK, MONOCLE } from '../clawd'
import { createBuffer, fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite } from '../scene'
import { C, every } from '../scenes/kit'
import { BUILDING } from './building'
import type { WaitingSceneId } from './deal'
import { HELPER_COLORS, type WaitingCtx, type WaitingScene } from './draw'
import { LAPTOPS } from './laptops'
import { AREA_W, clawdWalking, clawdX, type Helper, helperAt, type SeatLog } from './seats'

export { FALLBACK_WAITING, isWaitingScene, WAITING_SCENE_IDS, type WaitingSceneId } from './deal'
export { HELPER_COLORS } from './draw'
export { LAPTOP, LAPTOP_LIGHT, SPARK } from './laptops'

export const AREA_H = 14
// The repeating motions' periods all divide this many seconds.
export const WAITING_BEAT = 6
export const CUP = C.white
export const STEAM = C.glass

export const WAITING_SCENES: Record<WaitingSceneId, WaitingScene> = {
  laptops: LAPTOPS,
  building: BUILDING,
}

// A walking helper's top row: it stands on the bottom row.
const WALKING_TOP = 9

// The walking helper, facing right; mirrored, facing left. Two strides.
const WALKING = [
  ['.MMMMM.', '..MEME.', 'MMMMMMM', '.MMMMM.', '.M...M.'],
  ['.MMMMM.', '..MEME.', 'MMMMMMM', '.MMMMM.', '..M.M..'],
]

function drawWalker(b: PixelBuffer, h: Helper) {
  const color = HELPER_COLORS[h.entry.kind]
  const isLeft = h.pose === 'walk-in'
  drawSprite(b, { palette: { M: color, E: EYE_DARK }, frames: WALKING }, h.stride, h.x, WALKING_TOP, isLeft)
  if (h.entry.kind === 'fable') setPixel(b, isLeft ? h.x + 1 : h.x + 5, WALKING_TOP + 1, MONOCLE)
}

const SIP_FROM = 4
const SIP_TO = 5

function drawClawdAside(b: PixelBuffer, log: SeatLog, now: number, t: number) {
  const walking = clawdWalking(log, now)
  const x = clawdX(log, now)
  if (walking) {
    drawClawd(b, x, CLAWD_TOP, { pose: 'walk', stride: walking.stride, facing: walking.facing, arms: { left: 'down', right: 'out' } })
    drawCup(b, x, false, t)

    return
  }
  const isSipping = t % WAITING_BEAT >= SIP_FROM && t % WAITING_BEAT < SIP_TO
  const isBlinking = t % 3 < 0.15
  // He looks along the row for 1.5 s, then ahead for 1.5 s.
  const glance = every(t, 1.5) % 2 === 0 ? 1 : 0
  drawClawd(b, x, CLAWD_TOP, {
    eyes: isSipping ? 'closed' : 'open',
    isBlinking,
    look: { x: isSipping ? 0 : glance, y: 0 },
    arms: { left: 'down', right: isSipping ? 'up' : 'out' },
  })
  drawCup(b, x, isSipping, t)
}

// The cup on Clawd's right claw (held out, or raised to sip), steam rising
// from it while it is down.
function drawCup(b: PixelBuffer, x: number, isRaised: boolean, t: number) {
  if (isRaised) {
    fillRect(b, x + 12, CLAWD_TOP - 2, 2, 2, CUP)

    return
  }
  fillRect(b, x + 14, CLAWD_TOP, 2, 2, CUP)
  setPixel(b, x + 14 + (every(t, 0.5) % 2), CLAWD_TOP - 1, STEAM)
}

// The frame: the scene under the helpers, the seated and hopping helpers
// as the scene draws them, the scene over them, Clawd, then the walkers.
export function waitingFrame(log: SeatLog, now: number, scene: WaitingSceneId = 'laptops'): PixelBuffer {
  const b = createBuffer(AREA_W, AREA_H)
  const t = log.since === null ? 0 : (now - log.since) / 1000
  const helpers = log.entries.flatMap(e => {
    const h = helperAt(e, now)

    return h ? [h] : []
  })
  const seated = helpers.filter(h => h.pose === 'seated').sort((a, b2) => a.entry.seat - b2.entry.seat)
  const ctx: WaitingCtx = { t, now, log, helpers, seated }
  const drawn = WAITING_SCENES[scene]
  drawn.under?.(b, ctx)
  for (const h of helpers) if (h.pose === 'seated' || h.pose === 'hop') drawn.helper(b, h, ctx)
  drawn.over?.(b, ctx)
  drawClawdAside(b, log, now, t)
  for (const h of helpers) if (h.pose === 'walk-in' || h.pose === 'walk-out') drawWalker(b, h)

  return b
}
