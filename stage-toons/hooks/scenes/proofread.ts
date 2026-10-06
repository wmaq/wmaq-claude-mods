// Proofreading, a page or a checklist: Clawd holds the document up and
// taps a foot, waiting for the review. On a wider area a desk runs through
// the wings with stacks of paper on it, waiting their turn.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, CHECKLIST, every, PAGE, plankOn, still } from './kit'
import { tileOn } from './wide-d'

// The desk's top row, and a stack of paper on it every STACK_EVERY columns,
// as tall as these in turn: its sheets' edges shaded every other row, and a
// sheet or two sticking out.
const DESK_Y = 9
const STACK_EVERY = 11
const STACK_HEIGHTS = [4, 2, 5, 3]

function deskWithStacks(b: PixelBuffer) {
  plankOn(b, 50, DESK_Y, 4, 51, 23)
  tileOn(b, 54, STACK_EVERY, (x, k) => {
    const h = STACK_HEIGHTS[k % STACK_HEIGHTS.length]!
    fillRect(b, x, DESK_Y - h, 5, h, C.paper)
    for (let y = DESK_Y - 2; y >= DESK_Y - h; y -= 2) fillRect(b, x + ((y + k) % 3 === 0 ? 1 : 0), y, 4, 1, C.paperShade)
  })
}

function waiting(id: 'proofread-page' | 'proofread-checklist', doc: Sprite): Scene {
  const docW = doc.frames[0]?.[0]?.length ?? 0
  const docH = doc.frames[0]?.length ?? 0

  return {
    id,
    loop: 4,
    focusX: 24,
    backdrop: deskWithStacks,
    actors: [
      {
        kind: 'clawd',
        isHero: true,
        at: still(17, CLAWD_TOP),
        look: t => {
          const isTapping = t < 2 && every(t, 0.25) % 2 === 1

          return { pose: isTapping ? 'walk' : 'stand', stride: 1, isBlinking: blinking(t, 2), look: { x: t < 2 ? -1 : 1, y: 0 }, arms: { left: 'up', right: 'up' } }
        },
      },
    ],
    front: (b, t) => {
      drawSprite(b, doc, 0, 24 - Math.floor(docW / 2), CLAWD_TOP - docH)
      const dots = every(t, 0.5) % 4
      for (let i = 0; i < dots; i++) setPixel(b, 33 + i * 2, 5, C.gray)
    },
  }
}

export const proofreadPage = waiting('proofread-page', PAGE)
export const proofreadChecklist = waiting('proofread-checklist', CHECKLIST)
