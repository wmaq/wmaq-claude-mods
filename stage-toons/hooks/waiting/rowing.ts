// Rowing, a waiting scene: the helpers row a long boat on moving water,
// their oars in time, a splash at the end of each stroke; the boat bobs.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { C, every, line } from '../scenes/kit'
import { drawSitting, type WaitingCtx, type WaitingScene } from './draw'
import { AREA_W, type Helper } from './seats'

export const WATER = 0x2f5f9e
export const RIPPLE = C.blue
export const OAR = C.mortar
export const SPLASH = C.white
export const STROKE_S = 0.75
// The water from this column to the right edge; the bank under Clawd's cup.
const WATER_X = 16
const BANK_X = 14

// One pixel up for 0.5 s of every 1.5 s.
export const bobAt = (t: number): number => (t % 1.5 < 0.5 ? -1 : 0)
// The oars' stroke: forward (0) or back (1), all together.
export const strokeAt = (t: number): number => every(t, STROKE_S) % 2

function drawWater(b: PixelBuffer, { t }: WaitingCtx) {
  fillRect(b, WATER_X, 12, AREA_W - WATER_X, 2, WATER)
  // Light ripples drifting left, a pixel every 0.25 s.
  const shift = every(t, 0.25) % 8
  for (let x = WATER_X; x < AREA_W; x++) {
    if ((x + shift) % 8 === 0) setPixel(b, x, 12, RIPPLE)
    if ((x + shift + 4) % 8 === 0) setPixel(b, x, 13, RIPPLE)
  }
  fillRect(b, BANK_X, 13, WATER_X - BANK_X, 1, C.road)
  // The boat: its gunwale over its hull, both ends cut away.
  const dy = bobAt(t)
  fillRect(b, 17, 11 + dy, 30, 1, C.woodDark)
  fillRect(b, 18, 12 + dy, 28, 1, C.wood)
}

function drawRower(b: PixelBuffer, h: Helper, { t }: WaitingCtx) {
  // Sitting on the gunwale, claws out; standing up to leave, a row higher,
  // no oar.
  const top = (h.pose === 'hop' ? 7 : 8) + bobAt(t)
  drawSitting(b, h, h.x, top)
  if (h.pose === 'hop') return
  // The oar from its right claw down into the water: reaching forward, or
  // pulled back, with a splash at the end of the pull.
  const isBack = strokeAt(t) === 1
  const tipX = isBack ? h.x + 4 : h.x + 9
  line(b, h.x + 6, top + 3, tipX, 13, OAR)
  if (isBack && t % STROKE_S >= STROKE_S - 0.25) setPixel(b, tipX, 13, SPLASH)
}

export const ROWING: WaitingScene = { under: drawWater, helper: drawRower }
