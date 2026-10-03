// Bug hunt: a ladybug-sized bug scuttles along the ground and stops; Clawd
// follows it with a magnifying glass, peers at it wide-eyed, and off it
// runs again, back and forth.

import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, GLASS, lerp } from './kit'

const BUG: Sprite = { palette: { r: C.red, d: C.darkGray }, frames: [['.rr.', 'drrd'], ['.rr.', 'd..d']] }
const LOOP = 6
const GROUND = 12

// The bug's column over the loop: runs right, rests, runs back, rests.
function bugAt(time: number): number {
  const t = ((time % LOOP) + LOOP) % LOOP
  if (t < 1) return lerp(22, 34, t)
  if (t < 2.5) return 34
  if (t < 3.5) return lerp(34, 22, t - 2.5)

  return 22
}

const isRunning = (time: number): boolean => {
  const t = ((time % LOOP) + LOOP) % LOOP

  return t < 1 || (t >= 2.5 && t < 3.5)
}

// Clawd follows a beat behind, its right claw (holding the glass) over the bug.
const clawdAt = (t: number): number => Math.round(bugAt(t - 0.4)) - 16

export const bugHunt: Scene = {
  id: 'bug-hunt',
  loop: LOOP,
  focusX: 24,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: clawdAt(t), y: CLAWD_TOP }),
      look: t => {
        const isMoving = isRunning(t - 0.4)

        return {
          pose: isMoving ? 'walk' : 'stand',
          stride: Math.floor(clawdAt(t) * 2),
          facing: 1,
          eyes: !isMoving && !isRunning(t) ? 'wide' : 'open',
          isBlinking: isMoving && blinking(t, 0.6),
          look: { x: 1, y: 1 },
          arms: { left: 'down', right: 'out' },
        }
      },
    },
    { kind: 'sprite', sprite: BUG, frame: t => (isRunning(t) ? every(t, 0.1) % 2 : 0), at: t => ({ x: Math.round(bugAt(t)), y: GROUND }) },
  ],
  front: (b, t) => drawSprite(b, GLASS, 0, clawdAt(t) + 15, CLAWD_TOP + 1),
}
