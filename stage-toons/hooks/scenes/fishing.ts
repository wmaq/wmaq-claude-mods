// Fishing: Clawd fishes from the end of a jetty. Up comes an old boot, and
// on the next bite a fish. On a wider area the water runs to the edge, and
// now and then a fish jumps out of it with a splash.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, still, wave } from './kit'
import { tileOn } from './wings'

const LOOP = 8
const LINE_X = 30
const WATER = 11
const REEL_FOR = 0.8
const HOLD_FOR = 1
const BOOT: Sprite = { palette: { d: C.darkGray }, frames: [['dd.', 'dd.', 'ddd']] }
const FISH: Sprite = { palette: { g: C.green, y: C.gold }, frames: [['.ggg.g', 'gyggg.', '.ggg.g']] }
const CATCHES = [
  { from: 2.4, sprite: BOOT, x: LINE_X - 1 },
  { from: 6, sprite: FISH, x: LINE_X - 3 },
]

// On a wider area, fish jump in the wings: one every JUMP_EVERY columns
// from column 52, each at its own moment of the loop (JUMP_AT, in turn),
// leaping out of the water in an arc JUMP_W columns long and JUMP_H rows
// high over JUMP_FOR seconds, with a splash where it leaves the water and
// where it falls back in.
const JUMP_EVERY = 29
const JUMP_AT = [1.2, 5.1, 3.4, 7.3, 0.4, 4.6, 2.5, 6.2]
const JUMP_FOR = 1
const JUMP_W = 11
const JUMP_H = 5
const SPLASH_FOR = 0.3
// Facing right, rising, level at the top, and falling: its head tips up, then down.
const JUMPER: Sprite = { palette: { g: C.green }, frames: [['....g', 'g.ggg', '.gg..'], ['g.gg.', '.gggg', 'g.gg.'], ['.gg..', 'g.ggg', '....g']] }

function drawJumps(b: PixelBuffer, t: number) {
  tileOn(b, 52, JUMP_EVERY, (x, k) => {
    const age = (((t - JUMP_AT[k % JUMP_AT.length]!) % LOOP) + LOOP) % LOOP
    if (age < JUMP_FOR) {
      const p = age / JUMP_FOR
      const y = WATER - 3 - Math.round(JUMP_H * Math.sin(Math.PI * p))
      drawSprite(b, JUMPER, p < 0.35 ? 0 : p < 0.65 ? 1 : 2, x + Math.round(p * (JUMP_W - 5)), y)
    }
    // The splash: out at the start, back in at the end.
    if (age < SPLASH_FOR) splash(b, x + 1)
    else if (age >= JUMP_FOR - 0.1 && age < JUMP_FOR + SPLASH_FOR) splash(b, x + JUMP_W - 4)
  })
}

// Drops thrown up over the water, either side of a column.
function splash(b: PixelBuffer, x: number) {
  setPixel(b, x - 1, WATER - 1, C.glass)
  setPixel(b, x + 2, WATER - 1, C.glass)
  setPixel(b, x - 2, WATER - 2, C.white)
  setPixel(b, x + 3, WATER - 2, C.white)
}

// The catch on the line at a moment, and its top row, if any.
function caught(t: number) {
  for (const c of CATCHES) {
    const age = t - c.from
    if (age >= 0 && age < REEL_FOR + HOLD_FOR) return { ...c, y: Math.round(lerp(WATER, 3, age / REEL_FOR)) }
  }

  return null
}

export const fishing: Scene = {
  id: 'fishing',
  loop: LOOP,
  focusX: 24,
  backdrop: (b, t) => {
    fillRect(b, 0, 9, 21, 1, C.wood)
    fillRect(b, 3, 10, 1, 4, C.woodDark)
    fillRect(b, 17, 10, 1, 4, C.woodDark)
    fillRect(b, 21, WATER, rightOf(b) - 21, 3, C.blue)
    // 25 steps a loop over the 25 columns of water: the ripples come back
    // to where they started as the loop wraps. On a wider area the water
    // runs to the edge and its ripples repeat every 25 columns; the next
    // tile starts at column 47, which is drawn only past the bare stage.
    const tiles = rightOf(b) > 48 ? Math.ceil((rightOf(b) - 22) / 25) : 1
    for (let tile = 0; tile < tiles; tile++) {
      for (let k = 0; k < 3; k++) setPixel(b, 22 + 25 * tile + ((k * 9 + every(t, LOOP / 25)) % 25), WATER, C.glass)
    }
    drawJumps(b, t)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      // Sitting at y 1, Clawd's body rests on the jetty (row 9).
      at: still(6, 1),
      look: t => {
        const c = caught(t)
        const isHeld = c !== null && t - c.from >= REEL_FOR

        return { pose: 'sit', eyes: isHeld && c.sprite === FISH ? 'wide' : 'open', isBlinking: !isHeld && blinking(t, 1.4), look: { x: 1, y: isHeld ? 0 : 1 }, arms: { left: 'down', right: 'out' } }
      },
    },
  ],
  front: (b, t) => {
    // The rod, from the claw's tip (21, 5) up to (LINE_X, 1).
    for (let i = 0; i <= 9; i++) setPixel(b, 21 + i, 5 - Math.round((i * 4) / 9), C.wood)
    const c = caught(t)
    const end = c ? c.y - 1 : WATER - 1
    for (let y = 2; y <= end; y++) setPixel(b, LINE_X, y, C.gray)
    if (c) drawSprite(b, c.sprite, 0, c.x, c.y)
    else setPixel(b, LINE_X, WATER - (wave(t, 1.2) > 0.5 ? 1 : 0), C.red)
  },
}
