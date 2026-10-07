// Bowling: one of Claude testing's scenes. Clawd swings a ball back and
// bowls it down a lane that runs across the width; it rolls the length of
// the lane and crashes into the pins at the far end, which fly and fall,
// and a green tick lights up over the pin deck while Clawd cheers. Behind,
// quiet and dim: the alley's back wall, a score screen over every lane's
// length, and the masking panel over the pins. On a wider area the lane is
// longer, up to 150 columns, the ball rolling at the same speed; the loop
// fades in the next ball in Clawd's claw and the pins standing again.

import { CLAWD_W } from '../clawd'
import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, reach, still } from './kit'
import { eachColumn, eachItem, fade } from './layers'

const LOOP = 9
const CLAWD_X = 4
// The swing: the ball back behind Clawd, then forward and let go on the
// lane at RELEASE.
const BACKSWING = 0.5
const RELEASE = 1.2
// The ball's speed down the lane, columns a second.
const SPEED = 36
// The pins' fall after the hit, the tick's moment after it, and the cheer.
const FALL = 1.1
const TICK_AFTER = 0.5
const CHEER = 1.6

// The lane: its surface rows (the far gutter's edge, the boards), the
// ball's bottom row, and where the pin deck starts: as far as the lane
// reaches, 150 columns at most, short of the edge by the deck's width.
const LANE_TOP = 11
const FLOOR = 13
const BALL_START = CLAWD_X + CLAWD_W + 1
// The ball held at Clawd's side, on the floor by his claw.
const HOLD_X = CLAWD_X + CLAWD_W
const DECK_W = 14
const MAX = 150
const deckOf = (area: Area) => BALL_START + 6 + reach(area, BALL_START + 6, MAX, DECK_W + 2)
// When the ball reaches the pins on an area: at SPEED, but never in less
// than MIN_ROLL seconds, so a short lane's roll can still be followed.
const MIN_ROLL = 1.6
const rollOf = (area: Area) => Math.max(MIN_ROLL, (deckOf(area) - 1 - BALL_START) / SPEED)
const hitOf = (area: Area) => RELEASE + rollOf(area)

const BOARD = fade(C.wood, 0.45)
const BOARD_DARK = fade(C.wood, 0.58)
const GUTTER = fade(C.darkGray, 0.4)
const ARROW = fade(C.gold, 0.6)
const DECK = fade(C.paperShade, 0.62)
const WALL = fade(C.skyShade, 0.88)
const WALL_LINE = fade(C.skyShade, 0.8)
const SCREEN = fade(C.blue, 0.82)
const SCREEN_EDGE = fade(C.gray, 0.78)
const DIGIT = fade(C.paper, 0.7)
const MASK = fade(C.red, 0.78)
const MASK_EDGE = fade(C.gold, 0.74)

// The ball, rolling: its finger holes turn with it (four frames).
const BALL: Sprite = {
  palette: { b: C.blue, h: C.ink, s: C.glass },
  frames: [
    ['.bb.', 'bsbb', 'bhhb', '.bb.'],
    ['.bb.', 'bshb', 'bbhb', '.bb.'],
    ['.bb.', 'bbbb', 'bhhb', '.hb.'],
    ['.hb.', 'bhbb', 'bbbb', '.bb.'],
  ],
}
// A pin standing, tilting and lying; the back row's a shade dimmer.
const PIN_PAL = { w: C.white, r: C.red }
const PIN_BACK_PAL = { w: C.paperShade, r: fade(C.red, 0.3) }
const PIN_UP = ['.w.', 'www', '.r.', 'www', 'www']
const PIN_TILT = ['..w..', '.ww..', '.rw..', 'www..', 'ww...']
const PIN_DOWN = ['.....', '.....', 'w....', 'wwrww', '.wwww']

// The pins at the deck's columns: front row on the floor, back rows a
// row higher and behind; each flies off its own way at the hit (dx
// columns, rising to height, landing at its own moment).
type Pin = { dx: number; row: number; isBack: boolean; fly: number; height: number; land: number }
const PINS: Pin[] = [
  { dx: 7, row: 0, isBack: true, fly: 3, height: 4, land: 0.8 },
  { dx: 10, row: 0, isBack: true, fly: 1, height: 3, land: 0.7 },
  { dx: 4, row: 0, isBack: true, fly: 4, height: 5, land: 0.9 },
  { dx: 1, row: 1, isBack: false, fly: 3, height: 3, land: 0.6 },
  { dx: 5, row: 1, isBack: false, fly: 5, height: 6, land: 1 },
  { dx: 9, row: 1, isBack: false, fly: 2, height: 2, land: 0.5 },
]
// The tick over the deck.
const BIG_TICK: Sprite = { palette: { g: C.green }, frames: [['.....gg', '....gg.', 'gg.gg..', '.ggg...', '..g....']] }

// Where the ball is at t: in Clawd's claws on the swing, on the lane after
// the release, gone into the pit after the hit. Its left column and top
// row, or null.
function ballAt(t: number, area: Area): { x: number; y: number } | null {
  if (t < BACKSWING) return { x: HOLD_X, y: FLOOR - 3 }
  if (t < RELEASE - 0.35) {
    // Back behind him, raised.
    const k = (t - BACKSWING) / (RELEASE - 0.35 - BACKSWING)
    return { x: Math.round(lerp(HOLD_X, CLAWD_X - 3, k * 2)), y: Math.round(lerp(FLOOR - 3, FLOOR - 7, k)) }
  }
  if (t < RELEASE) {
    // Swung forward and down to the lane.
    const k = (t - (RELEASE - 0.35)) / 0.35
    return { x: Math.round(lerp(CLAWD_X - 3, BALL_START, k)), y: Math.round(lerp(FLOOR - 7, FLOOR - 3, k)) }
  }
  const hit = hitOf(area)
  if (t >= hit + 0.15) return null
  return { x: Math.round(lerp(BALL_START, deckOf(area) - 1, (t - RELEASE) / rollOf(area))), y: FLOOR - 3 }
}

const isAfterHit = (t: number, area: Area) => t >= hitOf(area)
const isCheering = (t: number, area: Area) => t >= hitOf(area) + TICK_AFTER && t < hitOf(area) + TICK_AFTER + CHEER

// The alley behind: the back wall and its rail, a score screen every 40
// columns hanging from the area's top with a struck "X" glowing on it,
// and over the pin deck the masking panel.
function drawAlley(b: PixelBuffer, t: number) {
  const area = areaOf(b)
  fillRect(b, area.left, area.top, area.right - area.left, LANE_TOP - area.top, WALL)
  // A dado rail along the wall, at the pins' heads.
  fillRect(b, area.left, 7, area.right - area.left, 1, WALL_LINE)
  const deck = deckOf(area)
  eachItem(b, 0, 40, 26, x => {
    if (x + 12 > deck - 2) return
    const top = area.top + 1
    fillRect(b, x, top, 12, 5, SCREEN_EDGE)
    fillRect(b, x + 1, top + 1, 10, 3, SCREEN)
    // The frames' marks: a strike "X" in each.
    for (let f = 0; f < 3; f++) {
      const fx = x + 2 + f * 3
      setPixel(b, fx, top + 1, DIGIT)
      setPixel(b, fx + 1, top + 2, DIGIT)
      setPixel(b, fx, top + 3, DIGIT)
      setPixel(b, fx + 2, top + 1, DIGIT)
      setPixel(b, fx + 2, top + 3, DIGIT)
    }
  })
  // The masking panel over the deck, down to the pins' heads.
  fillRect(b, deck - 1, area.top, DECK_W + 1, 4 - area.top, MASK)
  fillRect(b, deck - 1, 4, DECK_W + 1, 1, MASK_EDGE)
  // A light under the panel, on the deck: stronger once the tick is up.
  const isLit = t >= hitOf(area) + TICK_AFTER
  fillRect(b, deck, 5, DECK_W - 1, LANE_TOP - 5, isLit ? fade(C.green, 0.85) : fade(C.paper, 0.9))
}

// The lane: the far gutter's edge, boards running its length, the aiming
// arrows a third of the way down, and the pin deck at the far end.
function drawLane(b: PixelBuffer) {
  const area = areaOf(b)
  const deck = deckOf(area)
  eachColumn(b, 0, 7, (x, u) => {
    setPixel(b, x, LANE_TOP, GUTTER)
    for (let y = LANE_TOP + 1; y <= FLOOR; y++) setPixel(b, x, y, x >= deck - 1 ? DECK : (y + u) % 3 === 0 ? BOARD_DARK : BOARD)
  })
  // The arrows, a row of little chevrons.
  const arrows = Math.round(lerp(BALL_START + 4, deck, 0.3))
  for (let i = 0; i < 3; i++) {
    setPixel(b, arrows + i * 3, LANE_TOP + 2, ARROW)
    setPixel(b, arrows + i * 3 + 1, LANE_TOP + 1, ARROW)
  }
}

// The pins: standing until the hit, then each tumbles off its own way and
// lies where it lands; the dimmer back row first, the front row over it.
function drawPins(b: PixelBuffer, t: number) {
  const area = areaOf(b)
  const deck = deckOf(area)
  const k = t - hitOf(area)
  for (const pin of [...PINS].sort((p, q) => Number(q.isBack) - Number(p.isBack))) {
    const palette = pin.isBack ? PIN_BACK_PAL : PIN_PAL
    const baseY = FLOOR - 4 - (pin.isBack ? 1 : 0)
    if (k < 0) {
      drawSprite(b, { palette, frames: [PIN_UP] }, 0, deck + pin.dx, baseY)
      continue
    }
    const u = Math.min(1, k / (FALL * pin.land))
    const x = deck + pin.dx + Math.round(pin.fly * u)
    const y = baseY - Math.round(Math.sin(u * Math.PI) * pin.height)
    const frame = u >= 1 ? PIN_DOWN : PIN_TILT
    drawSprite(b, { palette, frames: [frame] }, 0, x, y)
  }
  // A few splinters of white at the hit.
  if (k >= 0 && k < 0.3) {
    for (let i = 0; i < 4; i++) setPixel(b, deck + 2 + i * 3, FLOOR - 6 - (i % 2) * 2 - Math.floor(k * 10), C.white)
  }
}

export const bowling: Scene = {
  id: 'bowling',
  loop: LOOP,
  still: RELEASE + 0.9,
  fadesAtLoop: true,
  // A narrow raster keeps Clawd and the ball's release in view.
  focusX: 15,
  backdrop: (b, t) => {
    drawAlley(b, t)
    drawLane(b)
  },
  actors: [
    { kind: 'prop', z: -1, draw: drawPins },
    {
      kind: 'clawd',
      isHero: true,
      at: still(CLAWD_X, CLAWD_TOP),
      look: (t, area) => {
        const isSwinging = t >= BACKSWING && t < RELEASE
        const isWatching = t >= RELEASE && !isAfterHit(t, area)

        return {
          pose: isCheering(t, area) && every(t, 0.25) % 2 === 0 ? 'jump' : 'stand',
          facing: 1,
          eyes: isCheering(t, area) ? 'wide' : 'open',
          isBlinking: !isSwinging && !isWatching && !isCheering(t, area) && blinking(t, 0.4),
          look: { x: 1, y: 0 },
          arms: isCheering(t, area)
            ? { left: 'up', right: 'up' }
            : t < BACKSWING
              ? { left: 'down', right: 'down' }
              : t < RELEASE - 0.35
                ? { left: 'out', right: 'down' }
                : t < RELEASE + 0.3
                  ? { left: 'down', right: 'out' }
                  : { left: 'down', right: 'down' },
        }
      },
    },
    {
      kind: 'prop',
      // Behind Clawd on the swing, so it passes behind him; on the lane
      // and the tick, in front.
      z: t => (t < RELEASE ? -1 : 1),
      draw: (b, t) => {
        const area = areaOf(b)
        const at = ballAt(t, area)
        if (at) drawSprite(b, BALL, t < RELEASE ? 0 : every(t, 0.06), at.x, at.y)
        if (t >= hitOf(area) + TICK_AFTER) drawSprite(b, BIG_TICK, 0, deckOf(area) + 3, area.top < 0 ? -1 : 0)
      },
    },
  ],
}
