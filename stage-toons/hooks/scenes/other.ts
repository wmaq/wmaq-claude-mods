// Other: Clawd walks up to a mystery box, pokes it, and walks back.

import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, BOX, every, lerp, QMARK } from './kit'

const walkX = (t: number) => (t < 1.5 ? lerp(6, 12, t / 1.5) : t < 4 ? 12 : lerp(12, 6, t - 4))
const isPoking = (t: number) => t >= 1.5 && t < 4 && every(t, 0.3) % 2 === 1

export const other: Scene = {
  id: 'other',
  loop: 5,
  focusX: 24,
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
    { kind: 'sprite', sprite: BOX, frame: () => 0, at: t => ({ x: 28 + (isPoking(t) ? 1 : 0), y: 5 }) },
    { kind: 'sprite', sprite: QMARK, frame: () => 0, at: t => ({ x: 31, y: every(t, 0.5) % 2 === 0 ? -1 : 0 }) },
  ],
}
