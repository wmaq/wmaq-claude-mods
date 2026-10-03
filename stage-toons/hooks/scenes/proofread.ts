// Proofreading, a page or a checklist: Clawd holds the document up and
// taps a foot, waiting for the review.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, CHECKLIST, every, PAGE, still } from './kit'

function waiting(id: 'proofread-page' | 'proofread-checklist', doc: Sprite): Scene {
  const docW = doc.frames[0]?.[0]?.length ?? 0
  const docH = doc.frames[0]?.length ?? 0

  return {
    id,
    loop: 4,
    focusX: 24,
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
