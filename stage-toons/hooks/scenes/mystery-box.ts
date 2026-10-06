// Mystery box: Clawd walks up to a mystery box, pokes it, and walks back.
// On a wider area, stacks of closed boxes stand in the wings, taped shut so
// none is taken for the mystery.

import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, BOX, C, every, lerp, QMARK } from './kit'
import { tileOn } from './wings'

const walkX = (t: number) => (t < 1.5 ? lerp(6, 12, t / 1.5) : t < 4 ? 12 : lerp(12, 6, t - 4))
// A closed box, its tape down the middle, and a smaller one; a stack is two
// boxes side by side with a small one on top, 19 columns wide, one every
// STACK_EVERY columns: 5 columns apart.
const TAPED: Sprite = {
  palette: { b: C.wood, d: C.woodDark, s: C.paperShade },
  frames: [['ddddddddd', 'dbbbsbbbd', 'dbbbsbbbd', 'dbbbsbbbd', 'dbbbsbbbd', 'dbbbsbbbd', 'ddddddddd']],
}
const SMALL: Sprite = { palette: { b: C.wood, d: C.woodDark, s: C.paperShade }, frames: [['ddddddd', 'dbbsbbd', 'dbbsbbd', 'dbbsbbd', 'ddddddd']] }
const STACK_EVERY = 24

const isPoking = (t: number) => t >= 1.5 && t < 4 && every(t, 0.3) % 2 === 1

export const mysteryBox: Scene = {
  id: 'mystery-box',
  loop: 5,
  focusX: 24,
  backdrop: b => {
    tileOn(b, 52, STACK_EVERY, x => {
      drawSprite(b, TAPED, 0, x, 7)
      drawSprite(b, TAPED, 0, x + 10, 7)
      drawSprite(b, SMALL, 0, x + 6, 2)
    })
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: walkX(t), y: CLAWD_TOP }),
      look: t => ({
        pose: t < 1.5 || t >= 4 ? 'walk' : 'stand',
        stride: Math.floor(walkX(t) * 2),
        facing: t >= 4 ? -1 : 1,
        isBlinking: blinking(t, 1.1),
        arms: { left: 'down', right: isPoking(t) ? 'out' : 'down' },
      }),
    },
    { kind: 'sprite', sprite: BOX, frame: () => 0, at: t => ({ x: 28 + (isPoking(t) ? 1 : 0), y: 7 }) },
    { kind: 'sprite', sprite: QMARK, frame: () => 0, at: t => ({ x: 31, y: every(t, 0.5) % 2 === 0 ? 1 : 2 }) },
  ],
}
