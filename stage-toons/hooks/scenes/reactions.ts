// Reactions: short overlays that play once over whatever scene is showing,
// on a layer of the area's size in the core's coordinates: the failure's
// bang rises over a high head into the headroom, the confetti falls over
// the whole area, and Fable walks from the area's real edge.

import { drawClawd, FABLE } from '../clawd'
import { type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, drawSprite, type ReactionId, type ReactionSpec, STAGE_W } from '../scene'
import { FABLE_X } from './fable-audit'
import { BANG, C, every, lerp } from './kit'

const CONFETTI = [C.gold, C.blue, C.green, C.red]

// Fable walks between FABLE_X and the area's edge (two columns past it) in
// the reaction's 2 s: at 10 pixels a second on a 48-column area, faster on
// a wider one. Her stride follows the distance walked at that speed or
// slower, and the time (a step each 0.125 s) when faster, so her feet
// don't flicker.
const WALK_S = 2
const STRIDE_S = 0.125

function walkFable(b: PixelBuffer, t: number, facing: number) {
  const edge = rightOf(b) + 2
  const x = facing < 0 ? lerp(edge, FABLE_X, t / WALK_S) : lerp(FABLE_X, edge, t / WALK_S)
  const stride = edge - FABLE_X <= STAGE_W + 2 - FABLE_X ? Math.floor(x) : every(t, STRIDE_S)
  drawClawd(b, x, CLAWD_TOP, { ...FABLE, pose: 'walk', stride, facing, arms: { left: 'down', right: 'down' } })
}

export const REACTIONS: Record<ReactionId, ReactionSpec> = {
  failure: {
    id: 'failure',
    mood: t => (t < 0.8 ? 'flinch' : null),
    draw: (b, t, hero) => {
      // Above a head higher than row 6, as far up as the area goes.
      const up = Math.max(Math.min(hero.y - CLAWD_TOP, 0), topOf(b))
      if (t < 2 && (t > 0.6 || every(t, 0.15) % 2 === 0)) drawSprite(b, BANG, 0, hero.x, 2 + up)
      if (t < 1.6) {
        const r = 1 + Math.min(5, Math.floor(t * 4))
        for (const side of [-1, 1]) {
          setPixel(b, hero.x + side * r, 4 + up, C.smoke)
          setPixel(b, hero.x + side * (r - 1), 3 + up, C.smoke)
        }
      }
    },
  },
  advance: {
    id: 'advance',
    mood: t => (t < 0.8 ? 'jump' : null),
    draw: (b, t) => {
      // 18 pieces to each 48 columns of the area, from its top.
      const left = rightOf(b) - b.w
      for (let group = 0; group * STAGE_W < b.w; group++) {
        for (let k = 0; k < 18; k++) {
          const y = Math.floor(t * (4 + (k % 3) * 2)) - (k % 5)
          const x = left + group * STAGE_W + ((k * 7 + 3) % STAGE_W) + Math.round(Math.sin(t * 4 + k))
          if (y >= 0 && y < b.h) setPixel(b, x, topOf(b) + y, CONFETTI[k % CONFETTI.length]!)
        }
      }
    },
  },
  'fable-arrives': { id: 'fable-arrives', draw: (b, t) => walkFable(b, t, -1) },
  'fable-leaves': { id: 'fable-leaves', draw: (b, t) => walkFable(b, t, 1) },
}
