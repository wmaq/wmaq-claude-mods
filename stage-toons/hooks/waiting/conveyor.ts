// Conveyor, a waiting scene: boxes ride a belt right to left past the
// helpers, each helper marking the boxes that pass its seat in its colour,
// so a box shows which helpers it passed while they were at work. The
// boxes and their marks are worked out from the time and the seat log.
// The belt runs on to the area's right edge; boxes start from its origin,
// just past the last seat, so they pass every seat in the same rhythm
// whatever the period's seats; with more than four, a box is a row taller,
// seats 4 to 7 marking its lower row.

import type { ModelKind } from '../agents'
import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { drawSprite } from '../scene'
import { C, every } from '../scenes/kit'
import { drawStanding, HELPER_COLORS, type WaitingCtx, type WaitingScene } from './draw'
import { AREA_W, type Helper, helperAt, SEATS, type SeatLog, seatX } from './seats'

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

// The belt's origin, where box 0 is at a period's start: past the last of
// its seats (48 with four).
export const beltOrigin = (seats: number): number => seatX(seats)

// Box j's left column at a period's time t (seconds): it starts at the
// belt's origin and moves left.
export const boxX = (j: number, t: number, origin = AREA_W): number => origin + BOX_GAP * j - Math.floor(t * BOX_SPEED)

// When box j passes seat s (its left column at the seat's), as a time.
const passesAt = (log: SeatLog, j: number, seat: number): number => (log.since ?? 0) + ((beltOrigin(log.seats) + BOX_GAP * j - seatX(seat)) / BOX_SPEED) * 1000

// The marks on box j by now: each seat whose helper was at work as the
// box passed it, that helper's model, and whether the mark is still new
// (it flashes).
export function marksOf(log: SeatLog, j: number, now: number): { seat: number; kind: ModelKind; isNew: boolean }[] {
  return Array.from({ length: log.seats }, (_, seat) => seat).flatMap(seat => {
    const at = passesAt(log, j, seat)
    if (at > now) return []
    const marker = log.entries.find(e => e.seat === seat && helperAt(e, at)?.pose === 'seated')

    return marker ? [{ seat, kind: marker.kind, isNew: now - at < FLASH_MS }] : []
  })
}

// The boxes on the belt now, from the belt's origin, as far as the edge:
// index and left column.
export function boxesAt(t: number, origin = AREA_W, edge = AREA_W): { j: number; x: number }[] {
  const travelled = Math.floor(t * BOX_SPEED)
  const out: { j: number; x: number }[] = []
  for (let j = Math.floor((travelled - origin) / BOX_GAP); j <= Math.ceil((travelled + edge - origin) / BOX_GAP); j++) {
    const x = boxX(j, t, origin)
    if (x >= BELT_X && x < edge) out.push({ j, x })
  }

  return out
}

function drawBelt(b: PixelBuffer, { t }: WaitingCtx) {
  const edge = rightOf(b)
  fillRect(b, BELT_X, 12, edge - BELT_X, 1, BELT)
  const shift = every(t, 1 / BOX_SPEED) % 4
  for (let x = BELT_X; x < edge; x++) {
    if ((x + shift) % 4 === 0) setPixel(b, x, 12, BELT_MARK)
    if (x % 4 === 2) setPixel(b, x, 13, BELT_MARK)
  }
}

// A helper behind the belt, its claws down as a box passes its seat.
function drawMarker(b: PixelBuffer, h: Helper, { t, log }: WaitingCtx) {
  if (h.pose === 'hop') {
    drawStanding(b, h, h.x, TOP - 1, 'up')

    return
  }
  const sinceBox = ((Math.floor(t * BOX_SPEED) - beltOrigin(log.seats) + seatX(h.entry.seat)) % BOX_GAP + BOX_GAP) % BOX_GAP
  drawStanding(b, h, h.x, TOP, sinceBox < 2 ? 'down' : 'out')
}

// A box: a dark lid and edges, a pale front its marks show on. Seats past
// the fourth mark the lid instead, above their fellows: the box keeps its
// size, so it hides no more of the helpers behind it.
const BOX = { palette: { d: C.woodDark, p: C.paper }, frames: [['dddddd', 'dppppd', 'dddddd']] }

function drawBoxes(b: PixelBuffer, { log, now, t }: WaitingCtx) {
  for (const { j, x } of boxesAt(t, beltOrigin(log.seats), rightOf(b))) {
    drawSprite(b, BOX, 0, x, BOX_TOP)
    for (const m of marksOf(log, j, now)) setPixel(b, x + 1 + (m.seat % SEATS), m.seat < SEATS ? BOX_TOP + 1 : BOX_TOP, m.isNew ? C.gold : HELPER_COLORS[m.kind])
  }
}

export const CONVEYOR: WaitingScene = { under: drawBelt, helper: drawMarker, over: drawBoxes }
