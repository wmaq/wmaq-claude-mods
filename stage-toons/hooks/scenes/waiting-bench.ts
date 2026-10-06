// Waiting bench: Clawd sits on a bench while a clock ticks, and now and
// then turns and waves at you. On a wider area the bench runs on to the
// edge, and along it, again and again, a "now serving" display on the
// wall counts up the tickets, a water cooler and a potted plant stand.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, still } from './kit'
import { tileOn, WINGS_X } from './wings'

const LOOP = 8
const WAVE_FROM = 4
const WAVE_TO = 5.6
// The wall clock: a round face 9 pixels across, a gray rim round a paper
// face, ticks at 12, 3, 6 and 9, and one hand going round.
const CLOCK = { x: 39, y: 5 }
// The rim, row by row from the top: each row's dx values.
const RIM_ROWS: number[][] = [[-1, 0, 1], [-3, -2, 2, 3], [-3, 3], [-4, 4], [-4, 4], [-4, 4], [-3, 3], [-3, -2, 2, 3], [-1, 0, 1]]
// The face inside it: each row's half width, from dy -3 to 3.
const FACE_HALF = [1, 2, 3, 3, 3, 2, 1]
const TICKS: [number, number][] = [[0, -3], [3, 0], [0, 3], [-3, 0]]
// The hand's tip in eight steps from twelve o'clock; two turns a loop.
const HAND: [number, number][] = [[0, -2], [2, -2], [2, 0], [2, 2], [0, 2], [-2, 2], [-2, 0], [-2, -2]]

function drawClock(b: PixelBuffer, t: number) {
  RIM_ROWS.forEach((xs, i) => xs.forEach(dx => setPixel(b, CLOCK.x + dx, CLOCK.y - 4 + i, C.gray)))
  FACE_HALF.forEach((half, i) => fillRect(b, CLOCK.x - half, CLOCK.y - 3 + i, 2 * half + 1, 1, C.paper))
  for (const [dx, dy] of TICKS) setPixel(b, CLOCK.x + dx, CLOCK.y + dy, C.darkGray)
  const [hx, hy] = HAND[every(t, 0.5) % HAND.length]!
  setPixel(b, CLOCK.x, CLOCK.y, C.ink)
  setPixel(b, CLOCK.x + Math.sign(hx), CLOCK.y + Math.sign(hy), C.ink)
  setPixel(b, CLOCK.x + hx, CLOCK.y + hy, C.ink)
}

// The wings, every ROOM_EVERY columns (three of the bench's legs) from the
// core's edge: the display on the wall, rows 2 to 8, then the cooler and
// the plant standing on the floor in front of the bench.
const ROOM_EVERY = 51
const DISPLAY_X = 3
const COOLER_X = 19
const PLANT_X = 35
// The display shows a ticket number in 3 x 5 digits, red on a dark
// screen. It counts up one every TICKET_EVERY seconds of the scene's
// unwrapped time, from FIRST_TICKET, round from 99 to 00: never back at
// the loop point.
const TICKET_EVERY = 3
const FIRST_TICKET = 42
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111']
export const ticketAt = (time: number): number => (FIRST_TICKET + every(Math.max(0, time), TICKET_EVERY)) % 100
const COOLER: Sprite = {
  palette: { g: C.glass, b: C.blue, s: C.paperShade, d: C.darkGray, r: C.red },
  frames: [['.ggg.', '.bbb.', '.bbb.', '..g..', 'sssss', 'sdsrs', 'sssss', 'sssss', 'sssss', 'sssss', 'd...d']],
}
const PLANT: Sprite = {
  palette: { g: C.green, p: C.brick },
  frames: [['..g..', 'g.g.g', '.ggg.', 'g.g.g', '.ggg.', '..g..', 'ppppp', '.ppp.', '.ppp.']],
}

function drawDisplay(b: PixelBuffer, time: number) {
  const ticket = ticketAt(time)
  const digits = [Math.floor(ticket / 10), ticket % 10]
  tileOn(b, WINGS_X, ROOM_EVERY, x => {
    const d = x + DISPLAY_X
    fillRect(b, d, 2, 11, 7, C.darkGray)
    fillRect(b, d + 1, 3, 9, 5, C.ink)
    digits.forEach((n, i) => {
      for (let p = 0; p < 15; p++) if (DIGITS[n]![p] === '1') setPixel(b, d + 1 + 4 * i + (p % 3) + 1, 3 + Math.floor(p / 3), C.red)
    })
  })
}

export const waitingBench: Scene = {
  id: 'waiting-bench',
  loop: LOOP,
  focusX: 24,
  // The display counts on the scene's unwrapped time.
  background: drawDisplay,
  backdrop: b => {
    fillRect(b, 6, 11, 22, 1, C.wood)
    fillRect(b, 8, 12, 1, 2, C.woodDark)
    fillRect(b, 25, 12, 1, 2, C.woodDark)
    // It ends at 27 on 48 columns; on a wider area it runs on from 28, a leg
    // every 17 columns after its right one (25), as far apart as its own.
    const edge = rightOf(b)
    if (edge <= 48) return
    fillRect(b, 28, 11, edge - 28, 1, C.wood)
    for (let x = 25 + 17; x < edge; x += 17) fillRect(b, x, 12, 1, 2, C.woodDark)
    tileOn(b, WINGS_X, ROOM_EVERY, x => {
      drawSprite(b, COOLER, 0, x + COOLER_X, 3)
      drawSprite(b, PLANT, 0, x + PLANT_X, 5)
    })
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      // Sitting, Clawd's body drops 2 pixels: at y 3 it rests on the seat (row 11).
      at: still(11, 3),
      look: t => {
        const isWaving = t >= WAVE_FROM && t < WAVE_TO

        return {
          pose: 'sit',
          isBlinking: blinking(t, 0.8),
          look: isWaving ? { x: 0, y: 1 } : { x: 1, y: -1 },
          arms: { left: 'down', right: isWaving ? (every(t, 0.25) % 2 === 0 ? 'up' : 'out') : 'down' },
        }
      },
    },
  ],
  front: drawClock,
}
