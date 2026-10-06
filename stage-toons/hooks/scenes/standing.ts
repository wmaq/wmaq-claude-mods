// Standing: Clawd stands, blinks and looks around. The fallback for a scene
// that broke.

import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, still } from './kit'

export const standing: Scene = {
  id: 'standing',
  loop: 4,
  still: 1.5,
  focusX: 24,
  actors: [{ kind: 'clawd', isHero: true, at: still(17, CLAWD_TOP), look: t => ({ isBlinking: blinking(t), look: { x: t < 2 ? -1 : 1, y: 0 } }) }],
}
