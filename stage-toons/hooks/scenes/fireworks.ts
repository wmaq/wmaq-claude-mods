// Fireworks: Done's scene. Clawd stands at the left looking up while three
// rockets rise on the right and burst, one after another, the sparks
// spreading, falling and fading; he jumps at each burst. Each rocket is
// over before the next starts, and the last before the loop ends. Dim far
// stars drift slowly behind. On a wider area more rockets go up in the
// wings, out of step with his three, and he cheers his own alone.

import { type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, drawStarfield, every, still } from './kit'

const LOOP = 8
const RISE = 0.8
const BURST = 1.4
const JUMP = 0.35
const ROCKETS = [
  { at: 0.2, x: 31, top: 5, color: C.gold },
  { at: 2.8, x: 41, top: 4, color: C.blue },
  { at: 5.4, x: 24, top: 5, color: C.green },
] as const
// The wings' rockets: two to each 48 columns past the core, a group's at
// x 48 further on per group. Each goes up about a second before or after
// one of the core's, so the two are in the air together, and all are over
// before the loop ends (the last by 6.6 s), so the loop needs no seam.
// Groups take the pairs in turn, so neighbours don't burst together.
type Rocket = { at: number; x: number; top: number; color: number }
const WING_PAIRS: readonly (readonly Rocket[])[] = [
  [
    { at: 1.2, x: 60, top: 6, color: C.red },
    { at: 3.8, x: 84, top: 5, color: C.green },
  ],
  [
    { at: 1.8, x: 60, top: 5, color: C.blue },
    { at: 4.4, x: 84, top: 6, color: C.gold },
  ],
]

// The eight directions a burst's sparks fly, unit steps.
const RAYS = [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) }))

// How long ago the burst under way began, or null when none is.
function burstAge(t: number): number | null {
  for (const r of ROCKETS) {
    const age = t - r.at - RISE
    if (age >= 0 && age < BURST) return age
  }

  return null
}

function drawRocket(b: PixelBuffer, r: Rocket, t: number) {
  const age = t - r.at
  if (age < 0 || age >= RISE + BURST) return
  if (age < RISE) {
    // The rocket climbs from the floor with a short grey trail.
    const y = Math.round(13 - (13 - r.top) * (age / RISE))
    setPixel(b, r.x, y, C.white)
    setPixel(b, r.x, y + 1, C.smoke)
    if (y + 2 <= 13) setPixel(b, r.x, y + 2, C.darkGray)

    return
  }
  const k = age - RISE
  const radius = Math.min(5, 1 + Math.floor(k * 8))
  const fall = Math.floor(k * k * 3)
  // Late in the burst the sparks twinkle out, every other frame.
  const isFading = k > BURST * 0.6
  if (radius <= 2 && !isFading) setPixel(b, r.x, r.top, C.white)
  RAYS.forEach((ray, i) => {
    if (isFading && (every(t, 0.1) + i) % 2 === 0) return
    // Each spark leaves a short streak: white behind it while fresh.
    for (const d of [radius - 1, radius]) {
      if (d < 1) continue
      const color = d === radius ? r.color : isFading ? C.smoke : C.white
      setPixel(b, r.x + Math.round(ray.x * d), r.top + Math.round(ray.y * d) + fall, color)
    }
  })
}

export const fireworks: Scene = {
  id: 'fireworks',
  loop: LOOP,
  still: 1.8,
  focusX: 20,
  background: (b, time) => drawStarfield(b, time, ['far']),
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => {
        const age = burstAge(t)
        const isCheering = age !== null && age < BURST * 0.6

        return {
          pose: age !== null && age < JUMP ? 'jump' : 'stand',
          isBlinking: age === null && blinking(t, 0.2),
          look: { x: 1, y: -1 },
          arms: isCheering ? { left: 'up', right: 'up' } : { left: 'down', right: 'down' },
        }
      },
    },
  ],
  front: (b, t) => {
    for (const r of ROCKETS) drawRocket(b, r, t)
    for (let g = 0; 48 * (g + 1) < rightOf(b); g++) {
      for (const r of WING_PAIRS[g % WING_PAIRS.length]!) drawRocket(b, { ...r, x: r.x + 48 * g }, t)
    }
  },
}
