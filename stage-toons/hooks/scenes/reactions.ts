// Reactions: short overlays that play once over whatever scene is showing.

import { drawClawd, FABLE } from '../clawd'
import { type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type ReactionId, type ReactionSpec, STAGE_H, STAGE_W } from '../scene'
import { FABLE_X } from './fable-audit'
import { BANG, C, every, lerp } from './kit'

const CONFETTI = [C.gold, C.blue, C.green, C.red]

function walkFable(b: PixelBuffer, x: number, facing: number) {
  drawClawd(b, x, CLAWD_TOP, { ...FABLE, pose: 'walk', stride: Math.floor(x), facing, arms: { left: 'down', right: 'down' } })
}

export const REACTIONS: Record<ReactionId, ReactionSpec> = {
  failure: {
    id: 'failure',
    mood: t => (t < 0.8 ? 'flinch' : null),
    draw: (b, t, hero) => {
      if (t < 2 && (t > 0.6 || every(t, 0.15) % 2 === 0)) drawSprite(b, BANG, 0, hero.x, 2)
      if (t < 1.6) {
        const r = 1 + Math.min(5, Math.floor(t * 4))
        for (const side of [-1, 1]) {
          setPixel(b, hero.x + side * r, 4, C.smoke)
          setPixel(b, hero.x + side * (r - 1), 3, C.smoke)
        }
      }
    },
  },
  advance: {
    id: 'advance',
    mood: t => (t < 0.8 ? 'jump' : null),
    draw: (b, t) => {
      for (let k = 0; k < 18; k++) {
        const y = Math.floor(t * (4 + (k % 3) * 2)) - (k % 5)
        if (y >= 0 && y < STAGE_H) setPixel(b, ((k * 7 + 3) % STAGE_W) + Math.round(Math.sin(t * 4 + k)), y, CONFETTI[k % CONFETTI.length]!)
      }
    },
  },
  'fable-arrives': { id: 'fable-arrives', draw: (b, t) => walkFable(b, lerp(STAGE_W + 2, FABLE_X, t / 2), -1) },
  'fable-leaves': { id: 'fable-leaves', draw: (b, t) => walkFable(b, lerp(FABLE_X, STAGE_W + 2, t / 2), 1) },
}
