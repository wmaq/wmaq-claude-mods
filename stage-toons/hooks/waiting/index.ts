// The waiting toon: while Claude waits on agents, Clawd stands aside with a
// cup and watches a row of helpers, one per agent at work, typing at their
// laptops, each in its model's colour. 48 x 14 pixels, drawn from the seat
// log and the time alone.

import type { ModelKind } from '../agents'
import { CLAWD_ORANGE, drawClawd, EYE_DARK, FABLE_VIOLET, MONOCLE } from '../clawd'
import { createBuffer, fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Sprite } from '../scene'
import { C, every } from '../scenes/kit'
import { AREA_W, clawdWalking, clawdX, type Helper, helperAt, type SeatLog } from './seats'

export const AREA_H = 14
// The repeating motions' periods all divide this many seconds.
export const WAITING_BEAT = 6

export const HELPER_COLORS: Record<ModelKind, number> = {
  sonnet: 0xe8559f,
  opus: CLAWD_ORANGE,
  fable: FABLE_VIOLET,
  haiku: 0x2bb3a8,
  unknown: 0xa3a3a3,
}
export const LAPTOP = 0x4a4f57
export const LAPTOP_LIGHT = C.glass
export const SPARK = C.gold
export const CUP = C.white
export const STEAM = C.glass

// A seated helper's top row; the desk's top and legs.
const SEATED_TOP = 7
const DESK_Y = 12
// A walking helper's top row: it stands on the bottom row.
const WALKING_TOP = 9

// The seated helper behind its laptop: M body, E eyes, L the laptop's back,
// o its light. The claws are drawn apart, tapping.
const SEATED = ['.MMMMM.', '.MEMEM.', '.MMMMM.', '.LLoLL.', '.LLLLL.']
// The walking helper, facing right; mirrored, facing left. Two strides.
const WALKING = [
  ['.MMMMM.', '..MEME.', 'MMMMMMM', '.MMMMM.', '.M...M.'],
  ['.MMMMM.', '..MEME.', 'MMMMMMM', '.MMMMM.', '..M.M..'],
]

function drawRows(b: PixelBuffer, rows: string[], x: number, y: number, colors: Record<string, number>, isMirrored = false) {
  rows.forEach((row, dy) => {
    const cells = isMirrored ? [...row].reverse() : [...row]
    cells.forEach((ch, dx) => {
      const c = colors[ch]
      if (c !== undefined) setPixel(b, x + dx, y + dy, c)
    })
  })
}

function drawDesk(b: PixelBuffer, x: number, hasLegs: boolean) {
  fillRect(b, x, DESK_Y, 7, 1, C.wood)
  if (!hasLegs) return
  setPixel(b, x + 1, DESK_Y + 1, C.woodDark)
  setPixel(b, x + 5, DESK_Y + 1, C.woodDark)
}

// t: seconds into the waiting period.
function drawHelper(b: PixelBuffer, h: Helper, t: number) {
  const color = HELPER_COLORS[h.entry.kind]
  const seat = h.entry.seat
  if (h.pose === 'seated') {
    drawDesk(b, h.x, true)
    // The laptop's light dims for a moment now and then, at each seat's own time.
    const isLit = (t + seat * 0.37) % 1.5 < 1.2
    drawRows(b, SEATED, h.x, SEATED_TOP, { M: color, E: EYE_DARK, L: LAPTOP, o: isLit ? LAPTOP_LIGHT : LAPTOP })
    // The claws tap in turns at the laptop's edges.
    const beat = every(t + seat * 0.125, 0.25) % 2
    setPixel(b, h.x, SEATED_TOP + 2 + beat, color)
    setPixel(b, h.x + 6, SEATED_TOP + 3 - beat, color)
    if (h.entry.kind === 'fable') setPixel(b, h.x + 5, SEATED_TOP + 1, MONOCLE)

    return
  }
  if (h.pose === 'hop') {
    // Up off the seat, the desk folding away under it.
    drawDesk(b, h.x, false)
    drawRows(b, SEATED.slice(0, 3), h.x, SEATED_TOP - 1, { M: color, E: EYE_DARK })
    setPixel(b, h.x, SEATED_TOP + 1, color)
    setPixel(b, h.x + 6, SEATED_TOP + 1, color)

    return
  }
  const rows = WALKING[h.stride % 2]!
  const isLeft = h.pose === 'walk-in'
  drawRows(b, rows, h.x, WALKING_TOP, { M: color, E: EYE_DARK }, isLeft)
  if (h.entry.kind === 'fable') setPixel(b, isLeft ? h.x + 1 : h.x + 5, WALKING_TOP + 1, MONOCLE)
}

// Every 2 s a spark pops above one seated helper's head for half a second,
// along the row.
function drawSpark(b: PixelBuffer, seated: Helper[], t: number) {
  if (seated.length === 0 || t % 2 >= 0.5) return
  const h = seated[every(t, 2) % seated.length]!
  const spark: Sprite = { palette: { y: SPARK }, frames: [['.y.', 'yyy', '.y.']] }
  drawSprite(b, spark, 0, h.x + 2, SEATED_TOP - 4)
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

export function waitingFrame(log: SeatLog, now: number): PixelBuffer {
  const b = createBuffer(AREA_W, AREA_H)
  const t = log.since === null ? 0 : (now - log.since) / 1000
  const helpers = log.entries.flatMap(e => {
    const h = helperAt(e, now)

    return h ? [h] : []
  })
  const seated = helpers.filter(h => h.pose === 'seated').sort((a, b2) => a.entry.seat - b2.entry.seat)
  for (const h of helpers) if (h.pose === 'seated' || h.pose === 'hop') drawHelper(b, h, t)
  drawSpark(b, seated, t)
  drawClawdAside(b, log, now, t)
  for (const h of helpers) if (h.pose === 'walk-in' || h.pose === 'walk-out') drawHelper(b, h, t)

  return b
}
