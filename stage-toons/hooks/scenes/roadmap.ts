// Roadmap: Clawd walks a winding road, a flag going up wherever it passes,
// then heads back to the start for the next leg.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, FLAG, lerp } from './kit'

const roadY = (x: number) => 9 + Math.round(Math.sin((x - 18) / 5) * 1.5)
const FLAGS = [20, 27, 34, 41]
// Seconds spent walking out; the rest of the loop is the walk back.
const OUT = 6
const walkX = (t: number) => (t < OUT ? lerp(2, 26, t / OUT) : lerp(26, 2, (t - OUT) / (8 - OUT)))

export const roadmap: Scene = {
  id: 'roadmap',
  loop: 8,
  focusX: 24,
  backdrop: b => {
    for (let x = 18; x < 48; x += 2) setPixel(b, x, roadY(x), C.road)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: walkX(t), y: CLAWD_TOP }),
      look: t => ({
        pose: 'walk',
        stride: Math.floor(walkX(t) * 2),
        facing: t < OUT ? 1 : -1,
        isBlinking: blinking(t),
        arms: { left: 'down', right: t < OUT ? 'out' : 'down' },
      }),
    },
  ],
  front: (b, t) => {
    // A flag goes up once Clawd's claw has passed it, and they all stand on
    // the walk back.
    for (const x of FLAGS) if (t >= OUT || walkX(t) + 15 >= x) drawSprite(b, FLAG, 0, x, roadY(x) - 4)
  },
}
