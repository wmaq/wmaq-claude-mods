// Fable's audit: Fable studies the scroll through a magnifying glass,
// question marks and ticks pop up, and Clawd fidgets, then nods. On a
// wider area shelves of reports already audited run on past them, a few
// with ticks.

import { FABLE } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, GLASS, QMARK, SCROLL, still, TICK, wave } from './kit'
import { shelvesOn, WINGS_X } from './wings'

export const OPUS_X = 4
export const FABLE_X = 30
// The wings: two shelves of reports standing face out, one in five with a
// small green tick, scattered so the ticks don't line up.
const REPORT: Sprite = {
  palette: { w: C.paper, l: C.paperShade, g: C.green },
  frames: [
    ['wwww', 'wllw', 'wwww', 'wllw'],
    ['wwww', 'wwwg', 'gwgw', 'wgww'],
  ],
}

function reports(b: PixelBuffer) {
  shelvesOn(b, WINGS_X + 2, [8, 13], 18, 5, (x, y, k, row) => drawSprite(b, REPORT, (k * 3 + row) % 5 === 1 ? 1 : 0, x, y - 3))
}

const isNodding = (t: number) => t % 3 >= 2 && t % 3 < 2.8

export const fableAudit: Scene = {
  id: 'fable-audit',
  loop: 6,
  still: 2.1,
  focusX: 24,
  backdrop: reports,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: OPUS_X, y: CLAWD_TOP + (isNodding(t) && every(t, 0.2) % 2 === 1 ? 1 : 0) }),
      look: t => ({
        facing: 1,
        isBlinking: blinking(t, 0.4),
        look: { x: isNodding(t) || every(t, 0.4) % 2 === 0 ? 1 : -1, y: isNodding(t) ? 1 : 0 },
        arms: { left: 'down', right: isNodding(t) ? 'up' : 'down' },
      }),
    },
    { kind: 'sprite', sprite: SCROLL, frame: () => 0, at: still(21, 8) },
    {
      kind: 'clawd',
      at: still(FABLE_X, CLAWD_TOP),
      look: t => ({ ...FABLE, facing: -1, isBlinking: blinking(t, 1.7), look: { x: -1, y: 1 }, arms: { left: 'out', right: 'down' } }),
    },
    { kind: 'sprite', sprite: GLASS, frame: () => 0, at: t => ({ x: 21 + Math.round((wave(t, 2) + 1) * 1.5), y: 7 }) },
  ],
  front: (b, t) => {
    const beat = t % 3
    if (beat >= 0.8 && beat < 1.6) drawSprite(b, QMARK, 0, 23, 1)
    else if (beat >= 2 && beat < 2.8) drawSprite(b, TICK, 0, 22, 2)
  },
}
