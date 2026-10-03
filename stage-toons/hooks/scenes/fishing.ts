// Fishing: Clawd fishes from the end of a jetty. Up comes an old boot, and
// on the next bite a fish.

import { fillRect, setPixel } from '../pixels'
import { drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, still, wave } from './kit'

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
    fillRect(b, 21, WATER, 27, 3, C.blue)
    for (let k = 0; k < 3; k++) setPixel(b, 22 + ((k * 9 + every(t, 0.5)) % 25), WATER, C.glass)
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
