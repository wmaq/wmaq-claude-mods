// Conveyor, a waiting scene: boxes ride a belt right to left past the
// helpers, each helper marking the boxes that pass its seat in its colour,
// so a box shows which helpers it passed while they were at work. The
// boxes and their marks are worked out from the time and the seat log.

import type { ModelKind } from '../agents'
import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { drawSprite } from '../scene'
import { C, every } from '../scenes/kit'
import { drawStanding, HELPER_COLORS, type WaitingCtx, type WaitingScene } from './draw'
import { AREA_W, type Helper, helperAt, SEAT_X, type SeatLog } from './seats'

// The belt's left end; boxes ride it every BOX_GAP pixels at BOX_SPEED
// pixels a second.
export const BELT_X = 16
export const BOX_GAP = 12
export const BOX_SPEED = 8
export const BOX_W = 6
export const FLASH_MS = 125
export const BELT = C.darkGray
export const BELT_MARK = C.gray
const TOP = 7
const BOX_TOP = 9

// Box j's left column at a period's time t (seconds): it comes in at the
// right edge and moves left.
export const boxX = (j: number, t: number): number => AREA_W + BOX_GAP * j - Math.floor(t * BOX_SPEED)

// When box j passes seat s (its left column at the seat's), as a time.
const passesAt = (log: SeatLog, j: number, seat: number): number => (log.since ?? 0) + ((AREA_W + BOX_GAP * j - SEAT_X[seat]!) / BOX_SPEED) * 1000

// The marks on box j by now: each seat whose helper was at work as the
// box passed it, that helper's model, and whether the mark is still new
// (it flashes).
export function marksOf(log: SeatLog, j: number, now: number): { seat: number; kind: ModelKind; isNew: boolean }[] {
  return SEAT_X.flatMap((_, seat) => {
    const at = passesAt(log, j, seat)
    if (at > now) return []
    const marker = log.entries.find(e => e.seat === seat && helperAt(e, at)?.pose === 'seated')

    return marker ? [{ seat, kind: marker.kind, isNew: now - at < FLASH_MS }] : []
  })
}

// The boxes on the belt now: index and left column.
export function boxesAt(t: number): { j: number; x: number }[] {
  const travelled = Math.floor(t * BOX_SPEED)
  const out: { j: number; x: number }[] = []
  for (let j = Math.floor((travelled - AREA_W) / BOX_GAP); j <= Math.ceil(travelled / BOX_GAP); j++) {
    const x = boxX(j, t)
    if (x >= BELT_X && x < AREA_W) out.push({ j, x })
  }

  return out
}

function drawBelt(b: PixelBuffer, { t }: WaitingCtx) {
  fillRect(b, BELT_X, 12, AREA_W - BELT_X, 1, BELT)
  const shift = every(t, 1 / BOX_SPEED) % 4
  for (let x = BELT_X; x < AREA_W; x++) {
    if ((x + shift) % 4 === 0) setPixel(b, x, 12, BELT_MARK)
    if (x % 4 === 2) setPixel(b, x, 13, BELT_MARK)
  }
}

// A helper behind the belt, its claws down as a box passes its seat.
function drawMarker(b: PixelBuffer, h: Helper, { t }: WaitingCtx) {
  if (h.pose === 'hop') {
    drawStanding(b, h, h.x, TOP - 1, 'up')

    return
  }
  const sinceBox = ((Math.floor(t * BOX_SPEED) - AREA_W + SEAT_X[h.entry.seat]!) % BOX_GAP + BOX_GAP) % BOX_GAP
  drawStanding(b, h, h.x, TOP, sinceBox < 2 ? 'down' : 'out')
}

// A box: a dark lid and edges, a pale front its marks show on.
const BOX = { palette: { d: C.woodDark, p: C.paper }, frames: [['dddddd', 'dppppd', 'dddddd']] }

function drawBoxes(b: PixelBuffer, { log, now, t }: WaitingCtx) {
  for (const { j, x } of boxesAt(t)) {
    drawSprite(b, BOX, 0, x, BOX_TOP)
    for (const m of marksOf(log, j, now)) setPixel(b, x + 1 + m.seat, BOX_TOP + 1, m.isNew ? C.gold : HELPER_COLORS[m.kind])
  }
}

export const CONVEYOR: WaitingScene = { under: drawBelt, helper: drawMarker, over: drawBoxes }
