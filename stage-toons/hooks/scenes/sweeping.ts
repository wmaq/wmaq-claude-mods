// Sweeping: Clawd sweeps back and forth while the docs fill a shelf. On a
// wider area the shelf runs on to the edge, holding docs shelved already.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { BROOM, C, every } from './kit'

const sweepX = (t: number) => 6 + 10 * (t < 4 ? t / 4 : (8 - t) / 4)
const facing = (t: number) => (t < 4 ? 1 : -1)
const BOOKS = [C.blue, C.red, C.green, C.gold]
// The shelf past the core holds the four colours in runs, with gaps wider
// than the runs: a full shelf of colour across a wide area pulls the eye
// from Clawd, as the core's 8 books don't.
const RUN = 4
const RUN_EVERY = 9

function shelf(b: PixelBuffer) {
  fillRect(b, 36, 7, 11, 1, C.woodDark)
  const edge = rightOf(b)
  // Column 47 only on a wider area: at 48 columns the shelf ends at 46.
  if (edge <= 48) return
  fillRect(b, 47, 7, edge - 47, 1, C.woodDark)
  for (let x = 48; x < edge; x++) if ((x - 48) % RUN_EVERY < RUN) fillRect(b, x, 3, 1, 4, BOOKS[((x - 48) % RUN_EVERY) % BOOKS.length]!)
}

export const sweeping: Scene = {
  id: 'sweeping',
  loop: 8,
  fadesAtLoop: true,
  focusX: 24,
  backdrop: shelf,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: sweepX(t), y: CLAWD_TOP }),
      look: t => ({ pose: 'walk', stride: Math.floor(t * 6), facing: facing(t), arms: { left: 'out', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const x = Math.round(sweepX(t)) + (facing(t) > 0 ? 15 : -3)
    drawSprite(b, BROOM, 0, x, 8)
    for (let k = 0; k < 4; k++) {
      const phase = (t * 3 + k * 0.25) % 1
      setPixel(b, x + 1 - facing(t) * (2 + k * 2), 13 - Math.floor(phase * 3), C.dust)
    }
    const shelved = Math.min(8, every(t, 1) + 1)
    for (let i = 0; i < shelved; i++) fillRect(b, 37 + i, 3, 1, 4, BOOKS[i % BOOKS.length]!)
  },
}
