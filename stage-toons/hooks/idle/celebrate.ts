// Celebrate: the work is Done. Clawd hops with his arms up while confetti
// falls beside him, in the colours of the bar's confetti: one piece a
// column of the box's free left part, so none hides another or lands on
// him. Each piece falls a whole number of times a loop, so the loop is
// seamless. The start heights and speeds were searched for (no formula in
// the column: those line the pieces up into diagonals): at any moment at
// most two neighbouring pieces are within a pixel of each other's height.

import { drawClawd } from '../clawd'
import { setPixel } from '../pixels'
import { blinking, C } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

export const CELEBRATE = 'celebrate'
const LOOP = 4
const HOP = 1
const BOX_H = 8
const CONFETTI = [C.gold, C.blue, C.green, C.red]
// Per column (0 to CLAWD_X - 1): where in its fall a piece starts, in
// twelfths, and how many times it falls a loop.
const STARTS = [9, 3, 0, 4, 11, 6, 10, 1, 5, 2, 7, 8]
const FALLS = [4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 3]

export const celebrate: IdleRoutine = {
  id: CELEBRATE,
  loop: LOOP,
  draw: (b, t) => {
    const isUp = t % HOP < HOP * 0.4
    for (let x = 0; x < CLAWD_X; x++) {
      const y = Math.floor((((t / LOOP) * FALLS[x]! + STARTS[x]! / 12) % 1) * BOX_H)
      setPixel(b, x, y, CONFETTI[(x * 3) % CONFETTI.length]!)
    }
    drawClawd(b, CLAWD_X, 0, {
      pose: isUp ? 'jump' : 'stand',
      isBlinking: blinking(t, 0.7),
      look: { x: -1, y: -1 },
      arms: { left: 'up', right: 'up' },
    })
  },
}
