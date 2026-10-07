// Dice: Clawd plays a board game. A board of squares runs from beside him
// to near the area's right edge, a goal square with a flag at its end. He
// shakes two big dice and rolls them; they tumble and land in front of the
// board, and the pawn hops along it, a square for each pip. He gathers the
// dice and rolls again, and the second roll takes the pawn onto the goal
// (on a wide area a double six, twice), where he cheers. The loop fades in
// the pawn back at the start. The rolls are made for the board, so the
// pawn always ends on the goal.

import { fillRect, type PixelBuffer } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, FLAG, lerp, reach, still } from './kit'

const LOOP = 9
// Each roll: shaken until SHAKE_FOR, tumbling until LANDED, the pawn's hops
// from HOPS_AT for HOPS_FOR; the first roll's dice gathered from GATHER.
const ROLLS = [0, 4.2]
const SHAKE_FOR = 0.5
const LANDED = 1.4
const HOPS_AT = 1.6
const HOPS_FOR = 2
const GATHER = 3.6
const GOAL_AT = ROLLS[1]! + HOPS_AT + HOPS_FOR

// The board, on a low table: a square every few columns from BOARD_X, a
// column apart, on rows 7 and 8, the table's edge row 9 and its legs under
// it; the pawn stands on the board, the dice land on the floor in front.
const BOARD_X = 25
const BOARD_Y = 7
const PAWN_Y = 2
// How far the board goes: up to MAX_SQUARES squares (two double sixes),
// up to 150 columns, its flag 2 short of the edge.
const MAX_SQUARES = 24
const MAX = 150
const SQUARES = [C.paper, C.red, C.paper, C.blue, C.paper, C.green]
const PAWN: Sprite = { palette: { p: C.blue }, frames: [['.p.', 'ppp', '.p.', '.p.', 'ppp']] }

// Each die held side by side over Clawd's claw (his right claw's tip is at
// 17, 8), short of the pawn's start, and where it lands, in front of the
// board.
const DICE = [
  { from: { x: 20, y: 3 }, to: { x: 32, y: 9 } },
  { from: { x: 15, y: 3 }, to: { x: 24, y: 9 } },
]
const PIPS: Record<number, string[]> = {
  1: ['...', '.#.', '...'],
  2: ['#..', '...', '..#'],
  3: ['#..', '.#.', '..#'],
  4: ['#.#', '...', '#.#'],
  5: ['#.#', '.#.', '#.#'],
  6: ['#.#', '#.#', '#.#'],
}
const FACES: Sprite = {
  palette: { w: C.white, i: C.ink },
  frames: [1, 2, 3, 4, 5, 6].map(n => ['wwwww', ...PIPS[n]!.map(r => `w${r.replaceAll('#', 'i').replaceAll('.', 'w')}w`), 'wwwww']),
}
// A die mid-tumble, on its corner.
const CORNER: Sprite = { palette: { w: C.white, s: C.paperShade }, frames: [['..w..', '.www.', 'wwsww', '.www.', '..w..']] }

// The board's pitch on an area: 4 columns a square, wider (up to 6) where
// the board has the room, so it runs on towards the edge.
const boardOf = (area: Area) => reach(area, BOARD_X, MAX, 7)
const stepOf = (area: Area) => Math.max(4, Math.min(6, Math.floor(boardOf(area) / MAX_SQUARES)))
// The squares to the goal on an area: 4 to MAX_SQUARES.
const squaresOf = (area: Area) => Math.max(4, Math.min(MAX_SQUARES, Math.floor(boardOf(area) / stepOf(area))))
// A square's left column.
const squareX = (k: number, area: Area) => BOARD_X + k * stepOf(area)

// The two rolls' totals, each 2 to 12, adding up to the squares to the
// goal; and each total as two dice.
function totalsOf(area: Area): [number, number] {
  const n = squaresOf(area)
  const first = Math.max(n - 12, Math.min(12, Math.max(2, Math.round(n * 0.45))))

  return [first, n - first]
}
const diceOf = (total: number): [number, number] => {
  const a = Math.min(6, Math.ceil(total / 2) + (total >= 4 ? 1 : 0))

  return [a, total - a]
}

// Which roll is under way at t (0 or 1), and the time into it.
const rollAt = (t: number) => (t < ROLLS[1]! ? 0 : 1)

// The pawn's square at t: whole squares, and the hop's progress between.
function pawnAt(t: number, area: Area): number {
  const [a, b] = totalsOf(area)
  const hops = (into: number, n: number) => Math.min(n, Math.max(0, ((into - HOPS_AT) / HOPS_FOR) * n))

  return hops(t, a) + (t >= ROLLS[1]! ? hops(t - ROLLS[1]!, b) : 0)
}

function dieAt(i: number, t: number) {
  const d = DICE[i]!
  const roll = rollAt(t)
  const into = t - ROLLS[roll]!
  if (into < SHAKE_FOR) return { x: d.from.x + (every(t, 0.1) % 2), y: d.from.y, isTumbling: false }
  if (into < LANDED) {
    const k = (into - SHAKE_FOR) / (LANDED - SHAKE_FOR)
    const bounce = Math.abs(Math.sin(k * Math.PI * 3)) * 4 * (1 - k)

    return { x: Math.round(lerp(d.from.x, d.to.x, k)), y: Math.round(lerp(d.from.y, d.to.y, k) - bounce), isTumbling: true }
  }
  if (roll === 1 || into < GATHER) return { ...d.to, isTumbling: false }
  // Gathered up in an arc, over his claw.
  const k = (into - GATHER) / (ROLLS[1]! - GATHER)

  return { x: Math.round(lerp(d.to.x, d.from.x, k)), y: Math.round(lerp(d.to.y, d.from.y, k) - 4 * Math.sin(Math.PI * k)), isTumbling: false }
}

// The board, to the goal: coloured squares and plain ones in turn, the goal
// gold with its flag, on the table.
function drawBoard(b: PixelBuffer) {
  const area = areaOf(b)
  const n = squaresOf(area)
  const w = stepOf(area) - 1
  const right = squareX(n, area) + w
  fillRect(b, BOARD_X - 1, BOARD_Y + 2, right + 1 - BOARD_X + 1, 1, C.wood)
  for (const x of [BOARD_X, right - 1]) fillRect(b, x, BOARD_Y + 3, 1, 14 - BOARD_Y - 3, C.woodDark)
  for (let k = 0; k <= n; k++) fillRect(b, squareX(k, area), BOARD_Y, w, 2, k === n ? C.gold : SQUARES[k % SQUARES.length]!)
  drawSprite(b, FLAG, 0, squareX(n, area) + w, PAWN_Y)
}

export const dice: Scene = {
  id: 'dice',
  loop: LOOP,
  still: 5.7,
  fadesAtLoop: true,
  focusX: 17,
  backdrop: drawBoard,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(2, CLAWD_TOP),
      look: t => {
        if (t >= GOAL_AT && t < GOAL_AT + 0.9) return { eyes: 'wide', look: { x: 1, y: 0 }, arms: { left: 'up', right: 'up' } }
        const into = t - ROLLS[rollAt(t)]!
        const isLanding = into >= LANDED && into < LANDED + 0.5
        if (isLanding) return { eyes: 'wide', look: { x: 1, y: 1 }, arms: { left: 'down', right: 'out' } }
        const isHolding = into < LANDED || (rollAt(t) === 0 && into >= GATHER)

        return { isBlinking: blinking(t, 1.2), look: { x: 1, y: into < LANDED ? 0 : 1 }, arms: { left: 'down', right: isHolding ? 'out' : 'down' } }
      },
    },
    // The pawn, hopping square by square.
    {
      kind: 'prop',
      draw: (b, t) => {
        const area = areaOf(b)
        const at = pawnAt(t, area)
        const hop = at - Math.floor(at)
        // Centred on its square.
        const inset = Math.floor((stepOf(area) - 4) / 2)
        drawSprite(b, PAWN, 0, Math.round(squareX(at, area)) + inset, Math.round(PAWN_Y - 2 * Math.sin(Math.PI * hop)))
      },
    },
  ],
  front: (b, t) => {
    const roll = rollAt(t)
    const faces = diceOf(totalsOf(areaOf(b))[roll]!)
    DICE.forEach((_, i) => {
      const at = dieAt(i, t)
      // Tumbling, a die shows a corner, then a face, every 0.12 s.
      const flip = every(t, 0.12) + i
      // Shaken in his claw, it shows a face, then another.
      const isShaken = t - ROLLS[roll]! < SHAKE_FOR
      if (at.isTumbling && flip % 2 === 0) drawSprite(b, CORNER, 0, at.x, at.y)
      else drawSprite(b, FACES, at.isTumbling || isShaken ? flip % 6 : faces[i]! - 1, at.x, at.y)
    })
    if (t >= GOAL_AT && t < GOAL_AT + 0.9 && every(t, 0.15) % 2 === 0) {
      // Sparkles round the flag.
      const x = squareX(squaresOf(areaOf(b)), areaOf(b))
      for (const [dx, dy] of [[-2, 2], [6, 1], [2, 0]] as const) drawSprite(b, { palette: { y: C.gold }, frames: [['.y.', 'yyy', '.y.']] }, 0, x + dx, dy)
    }
  },
}
