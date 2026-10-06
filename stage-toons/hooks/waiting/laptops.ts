// The laptops, the first waiting scene: each helper types at a laptop on a
// desk, the laptop's light dimming now and then, its claws tapping; every
// 2 s a spark pops over one seated helper, along the row.

import { EYE_DARK, MONOCLE } from '../clawd'
import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { drawSprite, type Sprite } from '../scene'
import { C, every } from '../scenes/kit'
import { HELPER_COLORS, type WaitingCtx, type WaitingScene } from './draw'
import type { Helper } from './seats'

export const LAPTOP = 0x4a4f57
export const LAPTOP_LIGHT = C.glass
export const SPARK = C.gold

// A seated helper's top row; the desk's top and legs.
const SEATED_TOP = 7
const DESK_Y = 12

// The seated helper behind its laptop: M body, E eyes, L the laptop's back,
// o its light. The claws are drawn apart, tapping.
const SEATED = ['.MMMMM.', '.MEMEM.', '.MMMMM.', '.LLoLL.', '.LLLLL.']
// Hopping off the seat: the body alone.
const HOPPING = SEATED.slice(0, 3)

function drawDesk(b: PixelBuffer, x: number, hasLegs: boolean) {
  fillRect(b, x, DESK_Y, 7, 1, C.wood)
  if (!hasLegs) return
  setPixel(b, x + 1, DESK_Y + 1, C.woodDark)
  setPixel(b, x + 5, DESK_Y + 1, C.woodDark)
}

function drawHelper(b: PixelBuffer, h: Helper, ctx: WaitingCtx) {
  const { t } = ctx
  const color = HELPER_COLORS[h.entry.kind]
  const seat = h.entry.seat
  if (h.pose === 'seated') {
    drawDesk(b, h.x, true)
    // The laptop's light dims for a moment now and then, at each seat's own time.
    const isLit = (t + seat * 0.37) % 1.5 < 1.2
    drawSprite(b, { palette: { M: color, E: EYE_DARK, L: LAPTOP, o: isLit ? LAPTOP_LIGHT : LAPTOP }, frames: [SEATED] }, 0, h.x, SEATED_TOP)
    // The claws tap in turns at the laptop's edges.
    const beat = every(t + seat * 0.125, 0.25) % 2
    setPixel(b, h.x, SEATED_TOP + 2 + beat, color)
    setPixel(b, h.x + 6, SEATED_TOP + 3 - beat, color)
    if (h.entry.kind === 'fable') setPixel(b, h.x + 5, SEATED_TOP + 1, MONOCLE)

    return
  }
  // Up off the seat, the desk folding away under it.
  drawDesk(b, h.x, false)
  drawSprite(b, { palette: { M: color, E: EYE_DARK }, frames: [HOPPING] }, 0, h.x, SEATED_TOP - 1)
  setPixel(b, h.x, SEATED_TOP + 1, color)
  setPixel(b, h.x + 6, SEATED_TOP + 1, color)
}

// Every 2 s a spark pops above one seated helper's head for half a second,
// along the row.
function drawSpark(b: PixelBuffer, { seated, t }: WaitingCtx) {
  if (seated.length === 0 || t % 2 >= 0.5) return
  const h = seated[every(t, 2) % seated.length]!
  const spark: Sprite = { palette: { y: SPARK }, frames: [['.y.', 'yyy', '.y.']] }
  drawSprite(b, spark, 0, h.x + 2, SEATED_TOP - 4)
}

export const LAPTOPS: WaitingScene = { helper: drawHelper, over: drawSpark }
