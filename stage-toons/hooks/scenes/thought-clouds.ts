// Thought clouds: Clawd sits and thinks; small clouds puff up over him,
// drift together into one big cloud with a spark in it, and thin away. On a
// wider area, slow clouds drift right to left across the wings' sky and
// thin away as they reach the core.

import { type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite, STAGE_W } from '../scene'
import { blinking, C, lerp, still } from './kit'
import { tileOn } from './wide-d'

const LOOP = 6
const PUFF: Sprite = {
  palette: { w: C.white, s: C.paperShade },
  frames: [['w'], ['ww', 'ss'], ['.ww.', 'wwww', '.ss.'], ['.www.', 'wwwww', '.sss.']],
}
// The big cloud, from the three puffs just touching (frame 0) to its full
// size (2), and its middle-sized frame (3) as it thins away.
const BIG: Sprite = {
  palette: { w: C.white, s: C.paperShade },
  frames: [
    ['.............', '.www.www.www.', 'wwwwwwwwwwwww', '.sss.sss.sss.', '.............'],
    ['.............', '..wwwwwwwww..', 'wwwwwwwwwwwww', '.wwwwwwwwwww.', '..sssssssss..'],
    ['...www.www...', '.wwwwwwwwwww.', 'wwwwwwwwwwwww', '.wwwwwwwwwww.', '..sssssssss..'],
    ['.............', '....wwwww....', '..wwwwwwwww..', '...sssssss...', '.............'],
  ],
}
// How long the cloud takes to swell from touching puffs to full, a frame
// at a time, and how long each thinning step lasts.
const SWELL_STEP = 0.15
const THIN_STEP = 0.2
const CENTRE = 24
const PUFFS = [
  { from: 0.4, x: 6 },
  { from: 1, x: 42 },
  { from: 1.6, x: CENTRE },
]
const DRIFT_FROM = 2.4
const MERGE_AT = 3.6
const THIN_AT = 5.4

// The wings' clouds: a pattern of SKY_EVERY columns, repeated from the core's
// edge to the area's, drifting left SKY_SPEED pixels a second. Each cloud is
// a puff's frame at its offset in the pattern and its row; within a few
// columns of the core it thins to smaller frames, and is gone at its edge.
const SKY_EVERY = 40
const SKY_SPEED = 1.5
// A puff's frames in dimmer colours: far off, so they don't pass for his
// thoughts.
const FAR_PUFF: Sprite = { palette: { w: C.paperShade, s: C.gray }, frames: PUFF.frames }
const SKY: { at: number; y: number; frame: number }[] = [
  { at: 4, y: 1, frame: 3 },
  { at: 25, y: 4, frame: 2 },
]

// Drawn in the background, with the scene's time unwrapped: the clouds
// drift on through the loop point with no jump.
function drawSky(b: PixelBuffer, time: number) {
  const drift = Math.floor(time * SKY_SPEED) % SKY_EVERY
  for (const cloud of SKY) {
    const offset = (((cloud.at - drift) % SKY_EVERY) + SKY_EVERY) % SKY_EVERY
    tileOn(b, STAGE_W + offset, SKY_EVERY, x => {
      const near = x - STAGE_W
      const frame = near < 2 ? 0 : near < 5 ? Math.min(1, cloud.frame) : near < 9 ? Math.min(2, cloud.frame) : cloud.frame
      drawSprite(b, FAR_PUFF, frame, x, cloud.y)
    })
  }
}

export const thoughtClouds: Scene = {
  id: 'thought-clouds',
  loop: LOOP,
  focusX: CENTRE,
  background: drawSky,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      // Sitting, his body takes rows 8 to 13, leaving the sky to the clouds.
      at: still(17, CLAWD_TOP),
      look: t => ({
        pose: 'sit',
        eyes: t >= MERGE_AT && t < MERGE_AT + 0.6 ? 'wide' : 'open',
        isBlinking: blinking(t, 0.6),
        look: { x: 0, y: -1 },
        arms: { left: 'down', right: 'down' },
      }),
    },
  ],
  front: (b, t) => {
    if (t >= 1.6 && t < THIN_AT) {
      // The thought's trail of dots from his head.
      setPixel(b, 25, 7, C.white)
      setPixel(b, 26, 5, C.white)
    }
    if (t >= MERGE_AT && t < THIN_AT) {
      const frame = Math.min(2, Math.floor((t - MERGE_AT) / SWELL_STEP))
      drawSprite(b, BIG, frame, CENTRE - 6, 0)
      if (frame === 2 && Math.floor(t / 0.3) % 2 === 0) setPixel(b, CENTRE, 2, C.gold)
      return
    }
    if (t >= THIN_AT) {
      // Thinning away: the big cloud shrinks to its middle size, a puff,
      // then a wisp.
      const step = Math.floor((t - THIN_AT) / THIN_STEP)
      if (step === 0) drawSprite(b, BIG, 3, CENTRE - 6, 0)
      else {
        const frame = step === 1 ? 3 : 0
        drawSprite(b, PUFF, frame, CENTRE - Math.floor(PUFF.frames[frame]![0]!.length / 2), 1)
      }
      return
    }
    for (const p of PUFFS) {
      if (t < p.from) continue
      const frame = Math.min(3, Math.floor((t - p.from) / 0.15))
      const x = Math.round(lerp(p.x, CENTRE + Math.sign(p.x - CENTRE) * 4, (t - DRIFT_FROM) / (MERGE_AT - DRIFT_FROM)))
      drawSprite(b, PUFF, frame, x - Math.floor(PUFF.frames[frame]![0]!.length / 2), 1)
    }
  },
}
