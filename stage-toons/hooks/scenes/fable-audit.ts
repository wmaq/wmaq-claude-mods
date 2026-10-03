// Fable's audit: Fable studies the scroll through a magnifying glass,
// question marks and ticks pop up, and Clawd fidgets, then nods.

import { FABLE } from '../clawd'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, every, GLASS, QMARK, SCROLL, still, TICK, wave } from './kit'

export const OPUS_X = 4
export const FABLE_X = 30
const isNodding = (t: number) => t % 3 >= 2 && t % 3 < 2.8

export const fableAudit: Scene = {
  id: 'fable-audit',
  loop: 6,
  focusX: 24,
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
