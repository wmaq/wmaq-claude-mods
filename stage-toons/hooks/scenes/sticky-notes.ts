// Sticky notes: Clawd sticks notes on a board one after another, and the
// last one gets a gold star. On a wider area a second board stands in the
// wings, fuller, its notes stuck there already.

import { fillRect } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, still } from './kit'

const STAR: Sprite = { palette: { y: C.gold }, frames: [['.y.', 'yyy', '.y.']] }
const NOTES = [
  { x: 27, y: 3, color: C.gold },
  { x: 33, y: 2, color: C.green },
  { x: 39, y: 4, color: C.blue },
  { x: 29, y: 8, color: C.paper },
  { x: 36, y: 8, color: C.red },
]
const PER_NOTE = 1
const LOOP = 7
const STARRED = NOTES.length * PER_NOTE + 0.3
// The second board, from column 50, and its notes: still, so the scene's
// fade at the loop point leaves it as it is.
const SECOND_X = 50
const SECOND_NOTES = [
  { x: 52, y: 4, color: C.blue },
  { x: 56, y: 3, color: C.gold },
  { x: 60, y: 5, color: C.paper },
  { x: 64, y: 3, color: C.green },
  { x: 69, y: 4, color: C.red },
  { x: 53, y: 8, color: C.green },
  { x: 57, y: 9, color: C.red },
  { x: 61, y: 8, color: C.gold },
  { x: 66, y: 8, color: C.blue },
  { x: 70, y: 9, color: C.paper },
]

export const stickyNotes: Scene = {
  id: 'sticky-notes',
  loop: LOOP,
  still: 4.2,
  fadesAtLoop: true,
  focusX: 30,
  backdrop: b => {
    fillRect(b, 24, 1, 21, 12, C.woodDark)
    fillRect(b, 25, 2, 19, 10, C.wood)
    fillRect(b, SECOND_X, 2, 25, 11, C.woodDark)
    fillRect(b, SECOND_X + 1, 3, 23, 9, C.wood)
    for (const note of SECOND_NOTES) fillRect(b, note.x, note.y, 3, 3, note.color)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(9, CLAWD_TOP),
      look: t => ({
        isBlinking: blinking(t, 1.1),
        look: { x: 1, y: -1 },
        arms: { left: 'down', right: t < NOTES.length * PER_NOTE && t % PER_NOTE < 0.3 ? 'out' : 'down' },
      }),
    },
  ],
  front: (b, t) => {
    const stuck = Math.min(NOTES.length, every(t, PER_NOTE) + 1)
    for (const note of NOTES.slice(0, stuck)) fillRect(b, note.x, note.y, 3, 3, note.color)
    // The star sits just above the last note.
    if (t >= STARRED && every(t, 0.3) % 2 === 0) drawSprite(b, STAR, 0, 36, 5)
  },
}
