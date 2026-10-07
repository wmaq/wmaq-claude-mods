// Proofreading, a page or a checklist: pages slide in one at a time along a
// desk from an in-tray at its far end, the tray emptying as they go. Clawd
// lifts each one, checks it over his head (a page read line by line, then
// ticked; a checklist's boxes ticked in turn) and passes it left onto the
// done pile on a cabinet, which grows. When the tray is empty he looks over
// the pile, and the loop fades in a full tray. Behind, quiet and dim: the
// page reads in a library (a wall of book shelves), the checklist in a
// planning room (a board of cards over filing cabinets).

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, lerp, reach } from './kit'
import { fade } from './layers'

const PAGES = 4
// A page's turn: it slides in, is lifted, checked and passed on. The next
// one starts sliding while this one is being checked.
const PER = 2.5
const SLIDE = 1.6
const LIFT = 0.2
const CHECK = 1.3
const PASS = 0.4
const HELD = SLIDE + LIFT
const CHECKED = HELD + CHECK
const PASSED = CHECKED + PASS
// The last page lands on the pile at 11; a beat to look it over.
const LOOP = (PAGES - 1) * PER + PASSED + 0.6

const CLAWD_X = 13
// The desk's top row, its first column, and where a sliding page stops,
// just past Clawd's right claw.
const DESK_Y = 10
const DESK_X = 29
const HAND_X = 29
// The in-tray's left column: up to 140 columns along the desk, short of
// the edge by the tray's width.
const TRAY_W = 9
const trayX = (area: Area) => DESK_X + reach(area, DESK_X, 140, TRAY_W + 1)
// The cabinet the done pile sits on, at the left.
const CABINET_X = 1
const CABINET_W = 10
const CABINET_Y = 10
const PILE_X = 2

const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 2

// Where page k is in its turn at t: seconds since it left the tray (below
// 0 still in it).
const turnOf = (t: number, k: number) => t - k * PER
// The page in Clawd's claws at t, and how far into its turn it is.
function inHand(t: number): { k: number; u: number } | undefined {
  for (let k = 0; k < PAGES; k++) {
    const u = turnOf(t, k)
    if (u >= SLIDE && u < PASSED) return { k, u }
  }

  return undefined
}
const onPile = (t: number) => Array.from({ length: PAGES }, (_, k) => k).filter(k => turnOf(t, k) >= PASSED).length
const inTray = (t: number) => Array.from({ length: PAGES }, (_, k) => k).filter(k => turnOf(t, k) < 0).length

// The scenery's shades: far, so faded well towards the background.
const SHELF = fade(C.wood, 0.78)
const SHELF_POST = fade(C.woodDark, 0.6)
const SPINES = [C.red, C.blue, C.green, C.gold, C.paperShade, C.brick].map(c => fade(c, 0.8))
const BOARD = fade(C.paperShade, 0.86)
const BOARD_EDGE = fade(C.wood, 0.72)
const CARDS = [C.paper, C.gold, C.sky, C.green].map(c => fade(c, 0.74))
const CABINETS = fade(C.gray, 0.78)
const CABINET_LINE = fade(C.gray, 0.86)
const HANDLE = fade(C.gray, 0.6)

// A small hash, for the shelves' books and the board's cards.
const hashOf = (n: number) => {
  let h = Math.imul(n + 11, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)

  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000
}

// The library: bookcases from the area's left edge to its right, a plank
// every five rows up into the headroom and an upright every 23 columns;
// along each plank runs of books, each run one colour and a few heights,
// with gaps between them.
function drawLibrary(b: PixelBuffer) {
  const { left, right, top } = areaOf(b)
  for (let plank = 9; plank >= top + 2; plank -= 5) {
    fillRect(b, left, plank, right - left, 1, SHELF)
    let x = left + Math.floor(hashOf(plank) * 4)
    for (let run = plank * 50; x < right; run++) {
      const n = 3 + Math.floor(hashOf(run) * 6)
      const color = SPINES[Math.floor(hashOf(run + 1000) * SPINES.length)]!
      for (let i = 0; i < n; i++) {
        const h = 2 + Math.floor(hashOf(run * 8 + i) * 2.4)
        // Every other book a shade darker, so the spines read apart.
        fillRect(b, x + i, plank - h, 1, Math.min(h, plank - top), i % 2 === 0 ? color : fade(color, 0.3))
      }
      x += n + 2 + Math.floor(hashOf(run + 2000) * 5)
    }
  }
  for (let x = left + 4; x < right; x += 23) fillRect(b, x, top, 1, 14 - top, SHELF_POST)
}

// The planning room: framed boards along the wall, each with a few
// columns of cards under their headings, and pairs of filing cabinets
// beneath, their drawers' handles dimly shining.
function drawPlanningRoom(b: PixelBuffer) {
  const { left, right, top } = areaOf(b)
  const boardTop = Math.max(top + 1, -2)
  for (let bx = left + 3; bx < right; bx += 34) {
    fillRect(b, bx, boardTop, 27, 8 - boardTop, BOARD_EDGE)
    fillRect(b, bx + 1, boardTop + 1, 25, 6 - boardTop, BOARD)
    for (let c = 0; c < 4; c++) {
      const x = bx + 2 + c * 6
      fillRect(b, x, boardTop + 2, 5, 1, BOARD_EDGE)
      const n = 1 + Math.floor(hashOf(x) * 3)
      for (let i = 0; i < n && boardTop + 4 + i * 3 < 7; i++) fillRect(b, x + (i % 2), boardTop + 4 + i * 3, 4, 2, CARDS[Math.floor(hashOf(x * 5 + i) * CARDS.length)]!)
    }
  }
  for (let x = left + 1; x < right; x += 21) {
    for (const cx of [x, x + 8]) {
      fillRect(b, cx, 8, 7, 6, CABINETS)
      fillRect(b, cx, 10, 7, 1, CABINET_LINE)
      fillRect(b, cx, 12, 7, 1, CABINET_LINE)
      setPixel(b, cx + 3, 9, HANDLE)
      setPixel(b, cx + 3, 11, HANDLE)
    }
  }
}

// The desk from DESK_X past the tray, legs at its ends and every 24
// columns; the cabinet at the left.
function drawFurniture(b: PixelBuffer) {
  const end = Math.min(rightOf(b), trayX(areaOf(b)) + TRAY_W + 2)
  fillRect(b, DESK_X, DESK_Y, end - DESK_X, 1, C.wood)
  for (let x = DESK_X + 1; x < end - 2; x += 24) fillRect(b, x, DESK_Y + 1, 1, 3, C.woodDark)
  fillRect(b, end - 2, DESK_Y + 1, 1, 3, C.woodDark)
  fillRect(b, CABINET_X, CABINET_Y, CABINET_W, 14 - CABINET_Y, C.woodDark)
  fillRect(b, CABINET_X + 1, CABINET_Y + 1, CABINET_W - 2, 2, C.wood)
  setPixel(b, CABINET_X + Math.floor(CABINET_W / 2), CABINET_Y + 2, C.gold)
}

// A sheet lying flat: its top and its shaded edge.
function flatSheet(b: PixelBuffer, x: number, y: number) {
  fillRect(b, x, y, 7, 1, C.paper)
  fillRect(b, x, y + 1, 7, 1, C.paperShade)
}

// The in-tray, a wire basket at the desk's far end, with the sheets still
// to check stacked in it.
function drawTray(b: PixelBuffer, t: number) {
  const x = trayX(areaOf(b))
  const n = inTray(t)
  for (let i = 0; i < n; i++) fillRect(b, x + 1, DESK_Y - 1 - i, TRAY_W - 2, 1, i % 2 === 0 ? C.paperShade : C.paper)
  fillRect(b, x, DESK_Y - 4, 1, 4, C.gray)
  fillRect(b, x + TRAY_W - 1, DESK_Y - 4, 1, 4, C.gray)
  fillRect(b, x, DESK_Y - 1, TRAY_W, 1, C.darkGray)
}

// The done pile: a sheet a page, each with its tick at the end.
function drawPile(b: PixelBuffer, n: number) {
  for (let i = 0; i < n; i++) {
    const y = CABINET_Y - 1 - i
    fillRect(b, PILE_X, y, 7, 1, i % 2 === 0 ? C.paperShade : C.paper)
    setPixel(b, PILE_X + 6, y, C.green)
  }
}

type Doc = { sprite: Sprite; ticks: (b: PixelBuffer, x: number, y: number, k: number) => void }

// The page: a sheet of text lines, ticked at its corner once read.
const PAGE_UP: Sprite = {
  palette: { w: C.paper, l: C.ink, s: C.paperShade },
  frames: [['wwwwwwww', 'wlllswww', 'wwwwwwww', 'wllswwww', 'wwwwwwww', 'wlllswww']],
}
const PAGE_TICK: Sprite = { palette: { x: C.green }, frames: [['...x', '..x.', 'x.x.', '.x..']] }
const PAGE_DOC: Doc = {
  sprite: PAGE_UP,
  // The tick lands once the reading is done (k: 0 to 1 through the check).
  ticks: (b, x, y, k) => {
    if (k >= 0.8) drawSprite(b, PAGE_TICK, 0, x + 4, y + 1)
  },
}

// The checklist: three boxes and their lines, ticked one by one.
const LIST_UP: Sprite = {
  palette: { w: C.paper, l: C.ink, o: C.gray },
  frames: [['wwwwwwww', 'wowllllw', 'wwwwwwww', 'wowlllww', 'wwwwwwww', 'wowllllw']],
}
const LIST_DOC: Doc = {
  sprite: LIST_UP,
  ticks: (b, x, y, k) => {
    for (let i = 0; i < 3; i++) if (k >= 0.15 + i * 0.28) setPixel(b, x + 1, y + 1 + i * 2, C.green)
  },
}

// Where the page in hand is: lifted from the desk to over Clawd's head,
// held there, then thrown in an arc onto the pile.
function docAt(u: number, w: number, h: number, pile: number): { x: number; y: number; isFlat: boolean } {
  const overX = CLAWD_X + 7 - w / 2
  const overY = CLAWD_TOP - h
  if (u < HELD) {
    // Up beside him first, then across over his head.
    const k = (u - SLIDE) / LIFT

    return { x: Math.round(lerp(HAND_X, overX, k * 2 - 1)), y: Math.round(lerp(DESK_Y - 2, overY, k * 2)), isFlat: false }
  }
  if (u < CHECKED) return { x: overX, y: overY, isFlat: false }
  // Thrown left over his head, then dropped onto the pile once clear of
  // him: never across his face.
  const k = (u - CHECKED) / PASS
  const x = Math.round(lerp(overX, PILE_X, Math.min(1, k / 0.6)))
  const drop = Math.max(0, (k - 0.6) / 0.4)
  const toY = CABINET_Y - 1 - pile - 1

  return { x, y: Math.round(lerp(overY, toY, drop)), isFlat: drop > 0.5 }
}

function proofread(id: 'proofread-page' | 'proofread-checklist', doc: Doc, backdrop: (b: PixelBuffer) => void): Scene {
  const docW = doc.sprite.frames[0]?.[0]?.length ?? 0
  const docH = doc.sprite.frames[0]?.length ?? 0

  return {
    id,
    loop: LOOP,
    // Page two near the end of its check, its ticks showing.
    still: PER + HELD + CHECK * 0.9,
    fadesAtLoop: true,
    focusX: CLAWD_X + 7,
    backdrop: (b: PixelBuffer) => {
      backdrop(b)
      drawFurniture(b)
    },
    actors: [
      {
        kind: 'prop',
        z: -1,
        draw: (b, t) => {
          drawTray(b, t)
          drawPile(b, onPile(t))
          // The pages sliding along the desk.
          for (let k = 0; k < PAGES; k++) {
            const u = turnOf(t, k)
            if (u < 0 || u >= SLIDE) continue
            const from = trayX(areaOf(b)) + 1
            flatSheet(b, Math.round(lerp(from, HAND_X, ease(u / SLIDE))), DESK_Y - 2)
          }
        },
      },
      {
        kind: 'clawd',
        isHero: true,
        at: () => ({ x: CLAWD_X, y: CLAWD_TOP }),
        look: t => {
          const held = inHand(t)
          if (held === undefined) {
            // Waiting for the next page, or looking over the pile at the end.
            const isDone = t >= LOOP - 0.6

            return isDone
              ? { facing: -1, look: { x: -1, y: 1 }, arms: { left: 'up', right: 'up' } }
              : { look: { x: 1, y: 0 }, isBlinking: blinking(t, 0.4), arms: { left: 'down', right: 'down' } }
          }
          if (held.u < CHECKED) {
            // Reading: the eyes up at the page, running along its lines.
            const k = (held.u - HELD) / CHECK

            return { look: { x: held.u < HELD ? 1 : Math.round(Math.sin(k * Math.PI * 5)), y: -1 }, arms: { left: 'up', right: 'up' } }
          }

          return { facing: -1, look: { x: -1, y: 0 }, arms: { left: 'out', right: 'down' } }
        },
      },
    ],
    front: (b, t) => {
      const held = inHand(t)
      if (held === undefined) return
      const p = docAt(held.u, docW, docH, onPile(t))
      if (p.isFlat) {
        flatSheet(b, p.x, p.y)

        return
      }
      drawSprite(b, doc.sprite, 0, p.x, p.y)
      doc.ticks(b, p.x, p.y, held.u < HELD ? 0 : held.u < CHECKED ? (held.u - HELD) / CHECK : 1)
    },
  }
}

export const proofreadPage = proofread('proofread-page', PAGE_DOC, drawLibrary)
export const proofreadChecklist = proofread('proofread-checklist', LIST_DOC, drawPlanningRoom)
