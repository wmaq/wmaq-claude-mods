// Coffee: Clawd holds a steaming mug out at his side, now and then lifts it
// and sips with his eyes closed.

import { drawClawd } from '../clawd'
import { type PixelBuffer, setPixel } from '../pixels'
import { drawSprite, type Sprite } from '../scene'
import { blinking, C, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const SIP_FROM = 2.6
const SIP_TO = 3.6
// The handle on the right, toward Clawd's claw; d is the coffee.
const MUG: Sprite = { palette: { w: C.white, d: C.woodDark, h: C.paperShade }, frames: [['wddw.', 'wwwwh', 'wwww.']] }

function drawSteam(b: PixelBuffer, t: number) {
  // Two wisps swaying, a pixel each, every 0.25 s; pale blue, never the
  // doze's z colour.
  const sway = every(t, 0.25) % 2
  setPixel(b, 7 + sway, 1, C.glass)
  setPixel(b, 8 - sway, 0, C.glass)
}

export const coffee: IdleRoutine = {
  id: 'coffee',
  loop: LOOP,
  still: 1,
  draw: (b, t) => {
    const isSipping = t >= SIP_FROM && t < SIP_TO
    if (isSipping) drawSprite(b, MUG, 0, 8, 1)
    else {
      drawSprite(b, MUG, 0, 6, 2)
      drawSteam(b, t)
    }
    drawClawd(b, CLAWD_X, 0, {
      eyes: isSipping ? 'closed' : 'open',
      isBlinking: blinking(t, 0.7),
      look: { x: -1, y: 0 },
      arms: { left: isSipping ? 'up' : 'out', right: 'down' },
    })
  },
}
