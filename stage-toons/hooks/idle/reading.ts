// Reading: Clawd holds an open book at his side, reads along its lines and
// turns a page every two seconds.

import { drawClawd } from '../clawd'
import { fillRect } from '../pixels'
import { drawSprite, type Sprite } from '../scene'
import { blinking, C, every, lerp } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const TURN_EVERY = 2
const TURN_FOR = 0.4
// Two pages either side of the spine, lines on each, the red cover below.
const BOOK: Sprite = {
  palette: { p: C.paper, l: C.paperShade, s: C.woodDark, r: C.red },
  frames: [['ppppp.ppppp', 'pllpp.pplpp', 'plllp.pllpp', 'ppppp.ppppp', 'rrrrrrrrrrr']],
}

export const reading: IdleRoutine = {
  id: 'reading',
  loop: LOOP,
  still: 1,
  draw: (b, t) => {
    drawSprite(b, BOOK, 0, 0, 2)
    fillRect(b, 5, 2, 1, 4, C.woodDark)
    const turning = t % TURN_EVERY - (TURN_EVERY - TURN_FOR)
    if (turning >= 0) {
      // The page lifts and sweeps from the right page over to the left.
      const x = Math.round(lerp(10, 0, turning / TURN_FOR))
      fillRect(b, x, 1, 1, 4, C.white)
    }
    drawClawd(b, CLAWD_X, 0, {
      isBlinking: blinking(t, 1.5),
      // His eyes run along the lines, then back.
      look: { x: every(t, 0.5) % 2 === 0 ? -1 : 0, y: 1 },
      arms: { left: 'out', right: 'down' },
    })
  },
}
