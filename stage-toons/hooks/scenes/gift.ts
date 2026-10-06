// Gift: Clawd pushes a gift your way, waits while you take it, and
// walks back for the next one. On a wider area the next ones wait past
// him, in piles of wrapped presents to the edge.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, every, GIFT, lerp } from './kit'
import { tileOn, WINGS_X } from './wings'

// Pushing until 1.5 s, waiting until 5 s, then walking back.
const clawdX = (t: number) => (t < 1.5 ? lerp(4, 10, t / 1.5) : t < 5 ? 10 : lerp(10, 4, t - 5))
const giftX = (t: number) => (t < 1.5 ? clawdX(t) + 16 : lerp(26, 34, t - 1.5))

// The wings: a pile of presents every PILE_EVERY columns, three on the
// floor and two on top, each wrapped in a paper with a ribbon of another
// colour and a bow; the papers turn round from pile to pile.
const PILE_EVERY = 34
const PAPERS = [C.blue, C.green, C.red, C.paper, C.gold]
const RIBBONS = [C.gold, C.red, C.gold, C.red, C.red]
// Each present's place in the pile, size and paper: [x, y, w, h, paper].
const PILE: [number, number, number, number, number][] = [
  [0, 9, 6, 5, 0],
  [6, 10, 5, 4, 1],
  [11, 9, 7, 5, 2],
  [2, 5, 5, 4, 3],
  [9, 6, 6, 3, 4],
]

function present(b: PixelBuffer, x: number, y: number, w: number, h: number, paper: number) {
  const mid = x + Math.floor(w / 2)
  fillRect(b, x, y, w, h, PAPERS[paper]!)
  fillRect(b, mid, y, 1, h, RIBBONS[paper]!)
  setPixel(b, mid - 1, y - 1, RIBBONS[paper]!)
  setPixel(b, mid + 1, y - 1, RIBBONS[paper]!)
}

// Only whole piles: a sliver of one at the edge reads as a stray box.
const PILE_W = 18

function presents(b: PixelBuffer) {
  tileOn(b, WINGS_X + 2, PILE_EVERY, (px, k) => {
    if (px + PILE_W > rightOf(b)) return
    for (const [x, y, w, h, paper] of PILE) present(b, px + x, y, w, h, (paper + k * 2) % PAPERS.length)
  })
}

export const gift: Scene = {
  id: 'gift',
  loop: 6,
  still: 3,
  fadesAtLoop: true,
  focusX: 24,
  backdrop: presents,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: clawdX(t), y: CLAWD_TOP }),
      look: t =>
        t < 1.5
          ? { pose: 'walk', stride: Math.floor(clawdX(t) * 2), facing: 1, arms: { left: 'out', right: 'out' } }
          : t < 5
            ? {
                pose: t > 3 && every(t, 0.3) % 2 === 1 ? 'walk' : 'stand',
                stride: 1,
                facing: 0,
                look: { x: 0, y: 1 },
                isBlinking: blinking(t, 0.3),
                arms: { left: 'down', right: 'down' },
              }
            : { pose: 'walk', stride: Math.floor(clawdX(t) * 2), facing: -1, arms: { left: 'down', right: 'down' } },
    },
  ],
  front: (b, t) => {
    // The gift is yours from 5 s on: it is gone when Clawd walks back.
    if (t >= 5) return
    drawSprite(b, GIFT, 0, Math.round(giftX(t)), 8)
    if (t >= 2.5 && every(t, 0.3) % 2 === 0) setPixel(b, 40, 7, C.gold)
  },
}
