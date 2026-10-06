// Dice: Clawd shakes two big dice and rolls them; they tumble, bounce and
// land on a double six, and he gathers them up again. On a wider area a
// board game's track runs along the floor past him, a pawn on it.

import { fillRect, type PixelBuffer } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, still } from './kit'
import { tileOn, WINGS_X } from './wings'

const LOOP = 7
const SHAKE_FOR = 0.6
const LANDED_AT = 2
const GATHER_AT = 5.6
const FLOOR = 9
// Each die held side by side at Clawd's claw (his right claw's tip is at
// 19, 8), and where it lands.
const DICE = [
  { from: { x: 24, y: 3 }, to: { x: 34, y: FLOOR } },
  { from: { x: 19, y: 3 }, to: { x: 26, y: FLOOR } },
]
const PIPS: Record<number, string[]> = {
  1: ['...', '.#.', '...'],
  2: ['#..', '...', '..#'],
  3: ['#..', '.#.', '..#'],
  4: ['#.#', '...', '#.#'],
  5: ['#.#', '.#.', '#.#'],
  6: ['#.#', '#.#', '#.#'],
}
const FACES: Sprite = {
  palette: { w: C.white, i: C.ink },
  frames: [1, 2, 3, 4, 5, 6].map(n => ['wwwww', ...PIPS[n]!.map(r => `w${r.replaceAll('#', 'i').replaceAll('.', 'w')}w`), 'wwwww']),
}
// A die mid-tumble, on its corner.
const CORNER: Sprite = { palette: { w: C.white, s: C.paperShade }, frames: [['..w..', '.www.', 'wwsww', '.www.', '..w..']] }
const SIX = 5

// The wings: the track's squares, 4 wide and 2 tall on the floor, every
// SQUARE_EVERY columns, plain ones between coloured ones; a pawn stands on
// one near the start.
const SQUARE_EVERY = 5
const SQUARES = [C.paper, C.red, C.paper, C.blue, C.paper, C.green, C.paper, C.gold]
const PAWN_ON = 4
const PAWN: Sprite = { palette: { p: C.blue }, frames: [['.pp.', 'pppp', '.pp.', '.pp.', 'pppp']] }

function track(b: PixelBuffer) {
  tileOn(b, WINGS_X + 1, SQUARE_EVERY, (x, k) => {
    fillRect(b, x, 12, 4, 2, SQUARES[k % SQUARES.length]!)
    if (k === PAWN_ON) drawSprite(b, PAWN, 0, x, 7)
  })
}

function dieAt(i: number, t: number) {
  const d = DICE[i]!
  if (t < SHAKE_FOR) return { x: d.from.x + (every(t, 0.1) % 2), y: d.from.y, isTumbling: false }
  if (t < LANDED_AT) {
    const k = (t - SHAKE_FOR) / (LANDED_AT - SHAKE_FOR)
    const bounce = Math.abs(Math.sin(k * Math.PI * 3)) * 4 * (1 - k)

    return { x: Math.round(lerp(d.from.x, d.to.x, k)), y: Math.round(lerp(d.from.y, d.to.y, k) - bounce), isTumbling: true }
  }
  if (t < GATHER_AT) return { ...d.to, isTumbling: false }
  const k = (t - GATHER_AT) / (LOOP - GATHER_AT)

  return { x: Math.round(lerp(d.to.x, d.from.x, k)), y: Math.round(lerp(d.to.y, d.from.y, k)), isTumbling: false }
}

export const dice: Scene = {
  id: 'dice',
  loop: LOOP,
  still: 1.5,
  focusX: 24,
  backdrop: track,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => {
        if (t >= LANDED_AT && t < LANDED_AT + 0.8) return { eyes: 'wide', look: { x: 1, y: 1 }, arms: { left: 'up', right: 'up' } }
        const isHolding = t < SHAKE_FOR || t >= GATHER_AT

        return { isBlinking: blinking(t, 1.2), look: { x: 1, y: t < LANDED_AT ? 0 : 1 }, arms: { left: 'down', right: isHolding || t < LANDED_AT ? 'out' : 'down' } }
      },
    },
  ],
  front: (b, t) => {
    DICE.forEach((_, i) => {
      const at = dieAt(i, t)
      // Tumbling, a die shows a corner, then a face, every 0.12 s.
      const flip = every(t, 0.12) + i
      if (at.isTumbling && flip % 2 === 0) drawSprite(b, CORNER, 0, at.x, at.y)
      else drawSprite(b, FACES, at.isTumbling ? flip % 6 : SIX, at.x, at.y)
    })
    if (t >= LANDED_AT && t < LANDED_AT + 0.6 && every(t, 0.15) % 2 === 0) {
      for (const x of [25, 32, 39]) drawSprite(b, { palette: { y: C.gold }, frames: [['.y.', 'yyy', '.y.']] }, 0, x, 5)
    }
  },
}
