// Sticky notes: one cork board runs the area's width, and Clawd walks
// along it from its left end, sticking notes as he goes, one high and one
// low in turn, with his left claw. Near the far end he steps back from
// the last one, turns to look along it all, and the last note gets a gold
// star; the loop fades back to a bare board. Behind the board, quiet and dim: the office's ceiling lamps,
// in the headroom of a taller area.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, reach, hash as seededHash } from './kit'
import { fade } from './layers'

const LOOP = 13
const STAR: Sprite = { palette: { y: C.gold }, frames: [['.y.', 'yyy', '.y.']] }

// The board: its frame from row 0 to row 11, from column 1 to one short of
// the area's right edge.
const BOARD_X = 1
const BOARD_TOP = 0
const BOARD_BOTTOM = 11
// Clawd's way: from column 6, up to 150 columns on, short of the edge by
// his width and two. He walks it but the last STEP_BACK columns, sticking
// notes, in 7 to 10 s (10 columns a second between); then steps back from
// the last note over those columns in STEP_S seconds, and the star comes
// on.
const START_X = 6
const MAX = 150
const PACE = 10
const SHORTEST = 7
const LONGEST = 10
const STEP_BACK = 6
const STEP_S = 1
// The notes: one every SPACING columns from column 5, high and low in turn;
// a high one goes up beside his raised claw as his left column passes one
// column beyond its own, a low one beside his claw held out, four beyond.
const NOTE_X = 6
const SPACING = 4
const HIGH_Y = 2
const LOW_Y = 7
const COLORS = [C.gold, C.green, C.blue, C.paper, C.red] as const

// The board and the room behind it, faded with distance.
const CORK = fade(C.wood, 0.5)
const CORK_DARK = fade(C.wood, 0.58)
const FRAME = fade(C.woodDark, 0.25)
const LAMP = fade(C.gold, 0.72)
const SHADE = fade(C.gray, 0.72)
const CORD = fade(C.gray, 0.8)

// A small hash, for the notes' colours and the cork's grain.
const hash = (n: number) => seededHash(n, 3)

const wayOf = (area: Area) => reach(area, START_X, MAX)
const walkOf = (area: Area) => Math.max(0, wayOf(area) - STEP_BACK)
const walkSeconds = (area: Area) => Math.max(SHORTEST, Math.min(LONGEST, walkOf(area) / PACE))

// Clawd's left column at t: walking right, then stepping back.
function clawdX(t: number, area: Area): number {
  const s = walkSeconds(area)
  const end = START_X + walkOf(area)
  if (t < s) return Math.round(lerp(START_X, end, t / s))

  return Math.round(lerp(end, START_X + wayOf(area), (t - s) / STEP_S))
}
const isWalking = (t: number, area: Area) => t < walkSeconds(area)
const isStarred = (t: number, area: Area) => t >= walkSeconds(area) + STEP_S

// Note i: its column, whether it is high, its row and colour.
function noteOf(i: number): { x: number; y: number; isHigh: boolean; color: number } {
  const isHigh = i % 2 === 0
  const x = NOTE_X + i * SPACING

  return { x, isHigh, y: (isHigh ? HIGH_Y : LOW_Y) + (hash(i) < 0.5 ? 0 : 1), color: COLORS[Math.floor(hash(i + 50) * COLORS.length)]! }
}
// Where Clawd's left column is when note i goes up: one column beyond a
// high note's, four beyond a low one's (so the columns only grow).
const placedAt = (i: number) => noteOf(i).x + (noteOf(i).isHigh ? 1 : 4)
// How many notes are up once his left column has reached x.
function notesUpTo(x: number): number {
  let n = 0
  while (placedAt(n) <= x) n++

  return n
}
// The notes up at t: as many as his walk has passed (stepping back, all of
// them).
const notesAt = (t: number, area: Area) => notesUpTo(isWalking(t, area) ? clawdX(t, area) : START_X + walkOf(area))

// His left claw at x: raised as he comes to a high note and just after, held
// out for a low one, else down.
function clawAt(x: number): 'up' | 'out' | 'down' {
  const up = notesUpTo(x)
  if (x - placedAt(up - 1) <= 1 && up > 0) return noteOf(up - 1).isHigh ? 'up' : 'out'
  if (placedAt(up) - x <= 2) return noteOf(up).isHigh ? 'up' : 'out'

  return 'down'
}

// The board across the area, with a little grain in the cork; above it, in
// a taller area's headroom, a ceiling lamp every 36 columns on its cord.
function drawBoard(b: PixelBuffer) {
  const { left } = areaOf(b)
  const right = rightOf(b) - 1
  const top = topOf(b)
  if (top < BOARD_TOP - 1) {
    for (let x = left + 18; x + 2 < right; x += 36) {
      fillRect(b, x, top, 1, BOARD_TOP - 2 - top, CORD)
      fillRect(b, x - 2, BOARD_TOP - 2, 5, 1, SHADE)
      fillRect(b, x - 1, BOARD_TOP - 1, 3, 1, LAMP)
    }
  }
  fillRect(b, BOARD_X, BOARD_TOP, right - BOARD_X, BOARD_BOTTOM - BOARD_TOP + 1, FRAME)
  fillRect(b, BOARD_X + 1, BOARD_TOP + 1, right - BOARD_X - 2, BOARD_BOTTOM - BOARD_TOP - 1, CORK)
  for (let x = BOARD_X + 2; x < right - 1; x++) {
    if (hash(x + 900) < 0.18) setPixel(b, x, BOARD_TOP + 1 + Math.floor(hash(x + 950) * (BOARD_BOTTOM - BOARD_TOP - 1)), CORK_DARK)
  }
}

function drawNotes(b: PixelBuffer, t: number) {
  const area = areaOf(b)
  const up = notesAt(t, area)
  for (let i = 0; i < up; i++) {
    const n = noteOf(i)
    fillRect(b, n.x, n.y, 3, 3, n.color)
  }
  // The star, blinking, just above the last note's right corner.
  if (up > 0 && isStarred(t, area) && every(t, 0.3) % 2 === 0) {
    const n = noteOf(up - 1)
    drawSprite(b, STAR, 0, n.x + 2, n.y - 2)
  }
}

export const stickyNotes: Scene = {
  id: 'sticky-notes',
  loop: LOOP,
  still: 5.6,
  fadesAtLoop: true,
  focusX: START_X + 7,
  // The camera follows Clawd along the board.
  focus: (t, area) => clawdX(t, area) + 7,
  backdrop: drawBoard,
  actors: [
    // The notes, behind Clawd: he walks past them.
    { kind: 'prop', z: -1, draw: drawNotes },
    {
      kind: 'clawd',
      isHero: true,
      at: (t, area) => ({ x: clawdX(t, area), y: CLAWD_TOP }),
      look: (t, area) => {
        const x = clawdX(t, area)
        if (!isWalking(t, area)) {
          // Stepping back from the last note, then turned to look along
          // the board.
          const isStepping = t < walkSeconds(area) + STEP_S

          return { pose: isStepping ? 'walk' : 'stand', stride: Math.floor(x / 2 + t * 2), facing: -1, isBlinking: blinking(t, 0.4), look: { x: -1, y: -1 }, arms: { left: 'down', right: 'down' } }
        }
        return {
          pose: 'walk',
          stride: Math.floor(x / 2 + t * 2),
          facing: 1,
          isBlinking: blinking(t, 1.1),
          look: { x: -1, y: -1 },
          arms: { left: clawAt(x), right: 'down' },
        }
      },
    },
  ],
}
