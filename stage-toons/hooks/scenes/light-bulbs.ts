// Light bulbs: ideas pop around Clawd and fizzle, until one stays lit: one
// peeks up from behind his head, one pops up in front of him. On a wider
// area, dim chalk symbols of maths float in the wings, bobbing gently; now
// and then one lights up gold for a moment, like an idea.

import { type PixelBuffer, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, BULB_OFF, BULB_ON, C, every, still, wave } from './kit'
import { tileOn } from './wings'

// z: behind Clawd (-1) or in front of him (1).
const SPOTS = [
  { x: 6, y: 3, z: 0 },
  { x: 38, y: 4, z: 0 },
  { x: 19, y: 4, z: -1 },
  { x: 28, y: 8, z: 1 },
]
const EUREKA = 4.8
const LOOP = 6

// The wings' symbols, in chalk ('x'; '.' is nothing): plus, minus, times,
// divide, equals, pi, a root, a sum, x squared and infinity.
export const GLYPHS: readonly (readonly string[])[] = [
  ['.x.', 'xxx', '.x.'],
  ['xxx'],
  ['x.x', '.x.', 'x.x'],
  ['.x.', '...', 'xxx', '...', '.x.'],
  ['xxx', '...', 'xxx'],
  ['xxxx', '.x.x', '.x.x'],
  ['..xxx', '..x..', 'x.x..', '.x...'],
  ['xxx', 'x..', '.x.', 'x..', 'xxx'],
  ['....xx', '.....x', 'x.x.x.', '.x..xx', 'x.x...'],
  ['.x.x.', 'x.x.x', '.x.x.'],
]
// Dim chalk, quieter than Clawd; a symbol that lights up turns gold.
export const CHALK = C.darkGray
// The wings' symbols: a pattern of SYMBOL_EVERY columns repeated from
// column 50 to the edge. Each spot has its column in the pattern, the row
// of its middle (in the core's coordinates: one above the core's top shows
// only on an area tall enough for it, bob and all) and its bob's phase.
// Each tile takes the glyphs on by 3, so neighbouring tiles differ.
const SYMBOL_EVERY = 40
const SYMBOLS = [
  { dx: 0, y: 3, phase: 0 },
  { dx: 8, y: 8, phase: 1.1 },
  { dx: 15, y: -1, phase: 2.3 },
  { dx: 21, y: 5, phase: 0.6 },
  { dx: 28, y: 1, phase: 1.8 },
  { dx: 33, y: 9, phase: 2.7 },
]
// Each symbol bobs a pixel up and down every BOB seconds (half the loop).
const BOB = 3
// Every fifth symbol lights up once a loop for LIT_FOR seconds, each at its
// own moment, scattered: one at a time, on an area up to 200 columns.
const LIT_FOR = 0.5

// The wings' symbols at a moment of the loop.
function drawSymbols(b: PixelBuffer, t: number) {
  const top = topOf(b)
  tileOn(b, 50, SYMBOL_EVERY, (x, k) => {
    SYMBOLS.forEach((s, i) => {
      const n = k * SYMBOLS.length + i
      const glyph = GLYPHS[(i + k * 3) % GLYPHS.length]!
      const from = s.y - Math.floor(glyph.length / 2)
      if (from - 1 < top) return
      const y = from + Math.round(wave(t + s.phase, BOB))
      const litAt = (n * 2.9) % LOOP
      const isLit = n % 5 === 2 && (((t - litAt) % LOOP) + LOOP) % LOOP < LIT_FOR
      glyph.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) if (row[dx] === 'x') setPixel(b, x + s.dx + dx, y + dy, isLit ? C.gold : CHALK)
      })
    })
  })
}

export const lightBulbs: Scene = {
  id: 'light-bulbs',
  loop: LOOP,
  focusX: 24,
  backdrop: drawSymbols,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(17, CLAWD_TOP),
      look: t =>
        t < EUREKA
          ? { isBlinking: blinking(t), look: { x: wave(t, 2) > 0 ? 1 : -1, y: -1 }, arms: { left: 'down', right: 'down' } }
          : { eyes: 'wide', arms: { left: 'up', right: 'up' } },
    },
    ...SPOTS.map((spot, i) => ({
      kind: 'prop' as const,
      z: spot.z,
      draw: (b: PixelBuffer, t: number) => {
        const age = t - i * 1.2
        if (age >= 0 && age < 0.9) drawSprite(b, age < 0.5 ? BULB_ON : BULB_OFF, 0, spot.x, spot.y)
      },
    })),
  ],
  front: (b, t) => {
    if (t >= EUREKA) {
      drawSprite(b, BULB_ON, 0, 23, 2)
      if (every(t, 0.2) % 2 === 0) {
        setPixel(b, 21, 3, C.gold)
        setPixel(b, 27, 3, C.gold)
      }
    }
  },
}
