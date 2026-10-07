// Victory lap: one of Done's scenes. Under bunting strung across the top,
// Clawd runs a lap of the track with a trophy held out in front: across
// the width, a cheer at the far end with the trophy raised, and back to
// the start, where he raises it again. Behind him, dim stands: the crowd
// rises as he passes, a wave that follows him, and a camera flashes here
// and there while he cheers. On a wider area the lap is longer, up to 150
// columns, at the same few seconds a leg; a taller area shows more of the
// stands.

import { CLAWD_W } from '../clawd'
import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, reach } from './kit'
import { eachColumn, fade, wrap } from './layers'

const LOOP = 14
const START_X = 4
const MAX = 150
// The lap's moments: off at GO, at the far end from OUT to BACK, home at
// HOME; a cheer at each end.
const GO = 0.8
const OUT = 5.6
const BACK = 7.6
const HOME = 12.4
// How long a leg's speed takes to build and to drop at its ends, as a
// share of the leg.
const EASE = 0.12

// The bunting: rope rows from the area's top, sagging between hang points
// every SPAN columns; pennants every 3 columns.
const SPAN = 16
const ROPE = fade(C.paper, 0.7)
const PENNANTS = [fade(C.red, 0.3), fade(C.gold, 0.42), fade(C.blue, 0.3), fade(C.green, 0.32)] as const
// The bunting's lowest row, below the area's top.
const BUNTING_H = 3

// The stands: the crowd in tiers, a tier every 3 rows up from the
// barrier, each a dim silhouette (heads over a band of shoulders, a few
// coloured scarves), the higher ones fainter; a tier shows only where its
// standing crowd stays clear of the bunting.
const TIER_HEAD = 7
const TIER_STEP = 3
const TIER_FADE = [0.74, 0.82, 0.88] as const
const SCARVES = [C.red, C.blue, C.green, C.gold] as const
const BARRIER = fade(C.gray, 0.84)
const RAIL = fade(C.paperShade, 0.72)
const TRACK = fade(C.brick, 0.62)
const LANE = fade(C.paper, 0.74)
const FLASH = fade(C.white, 0.2)
// How far behind Clawd's middle the crowd stands up, and how faded the scarves
// it waves are.
const WAVE = 20
const SCARF_FADE = 0.4

const TROPHY: Sprite = { palette: { y: C.gold, w: C.white, d: C.brassDark }, frames: [['ywyyy', 'yyyyy', '.yyy.', '..y..', '.ddd.']] }

// A small hash, for empty seats and shirts.
const hash = (n: number) => {
  let h = Math.imul(n + 11, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)

  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000
}

// A leg's progress, 0 to 1, with its speed building and dropping at the
// ends: a quick start, a steady run, a short slow-down.
function legAt(k: number): number {
  const u = Math.max(0, Math.min(1, k))
  const top = 1 / (1 - EASE)
  if (u < EASE) return (top * u * u) / (2 * EASE)
  if (u > 1 - EASE) return 1 - (top * (1 - u) * (1 - u)) / (2 * EASE)

  return top * (u - EASE / 2)
}

// The lap's length on an area, and Clawd's left column at t.
const lapOf = (area: Area) => reach(area, START_X, MAX, CLAWD_W + 6)
function clawdX(t: number, area: Area): number {
  const lap = lapOf(area)
  if (t < OUT) return Math.round(START_X + lap * legAt((t - GO) / (OUT - GO)))
  if (t < BACK) return START_X + lap
  return Math.round(START_X + lap * (1 - legAt((t - BACK) / (HOME - BACK))))
}
const isRunning = (t: number) => (t >= GO && t < OUT) || (t >= BACK && t < HOME)
const isCheering = (t: number) => (t >= OUT + 0.3 && t < BACK - 0.3) || (t >= HOME + 0.2 && t < LOOP - 0.4)
// Which way he faces: right on the way out and at home, left at the far
// end and on the way back.
const facingAt = (t: number) => (t >= OUT + 0.15 && t < HOME ? -1 : 1)

// The bunting across the top: a rope sagging between hang points, a
// pennant every 3 columns hanging from it, colours in turn, each tip
// fluttering now and then: 40 flutter steps a loop, so it meets itself at
// the loop point.
function drawBunting(b: PixelBuffer, t: number) {
  const top = areaOf(b).top
  eachColumn(b, 0, SPAN, (x, u) => {
    const sag = Math.round(Math.sin((u / SPAN) * Math.PI) * 1.4)
    const y = top + sag
    setPixel(b, x, y, ROPE)
    // A pennant at every third column but the hang point's.
    if (u % 3 !== 2) return
    const i = Math.floor((x + 1000) / 3)
    const color = PENNANTS[wrap(i, PENNANTS.length)]!
    fillRect(b, x - 1, y + 1, 3, 1, color)
    const flutter = wrap(every(t, 0.35) + i * 3, 8) === 0 ? 1 : 0
    setPixel(b, x + flutter, y + 2, color)
  })
}

// Whether the crowd at column x is up: where Clawd has just run past, up
// to WAVE columns behind him, and a few columns ahead; all round him while
// he stands or cheers.
function isStanding(x: number, t: number, middle: number): boolean {
  const ahead = (x - middle) * (isRunning(t) ? facingAt(t) : 1)
  if (!isRunning(t)) return Math.abs(ahead) <= WAVE

  return ahead >= -WAVE && ahead <= CLAWD_W / 2 + 3
}

// The stands: the barrier behind the track, its rail, and above it the
// tiers that fit under the bunting. Near Clawd the crowd stands and waves
// its scarves: a wave that follows him. While he
// cheers a camera flashes at a seat or two away from him.
function drawStands(b: PixelBuffer, t: number) {
  const area = areaOf(b)
  const width = area.right - area.left
  const middle = clawdX(t, area) + CLAWD_W / 2
  const flashOdds = 0.015 * Math.min(1, 120 / width)
  fillRect(b, area.left, 10, width, 1, RAIL)
  fillRect(b, area.left, 11, width, 1, BARRIER)
  // The furthest tier first, so a nearer tier's scarves show over it.
  for (let tier = TIER_FADE.length - 1; tier >= 0; tier--) {
    const head = TIER_HEAD - tier * TIER_STEP
    if (head - 2 < area.top + BUNTING_H + 2) continue
    const k = TIER_FADE[tier]!
    for (let x = area.left; x < area.right; x++) {
      const seat = x * 5 + tier * 977
      fillRect(b, x, head + 1, 1, 2, fade(C.skyShade, k))
      // A head every other column, a seat or so empty.
      const isHead = wrap(x + tier, 2) === 0 && hash(seat) > 0.12
      if (!isHead) continue
      const isUp = isStanding(x, t, middle)
      const scarf = fade(SCARVES[Math.floor(hash(seat + 1) * SCARVES.length)]!, SCARF_FADE)
      // Standing near Clawd: the head a row up, and a scarf waved over it,
      // up and down in turn.
      setPixel(b, x, head - (isUp ? 1 : 0), fade(C.skyShade, k))
      if (isUp) {
        setPixel(b, x, head, fade(C.skyShade, k))
        if (wrap(Math.floor(x / 2) + every(t, 0.25), 2) === 0) setPixel(b, x + 1, head - 2, scarf)
        else setPixel(b, x + 1, head - 1, scarf)
      } else if (hash(seat + 3) < 0.2) setPixel(b, x, head + 1, fade(SCARVES[Math.floor(hash(seat + 1) * SCARVES.length)]!, k - 0.08))
      // A camera's flash, a tenth of a second at a time: as many on a wide
      // area as on 120 columns.
      if (isCheering(t) && Math.abs(x - middle) > CLAWD_W && hash(seat + every(t, 0.1) * 31) < flashOdds) setPixel(b, x, head, FLASH)
    }
  }
}

// The track under Clawd's feet, a dashed lane line along it.
function drawTrack(b: PixelBuffer) {
  eachColumn(b, 0, 6, (x, u) => {
    setPixel(b, x, 12, u < 3 ? LANE : TRACK)
    setPixel(b, x, 13, TRACK)
  })
}

// Clawd's arms: the trophy held out in front while he runs and stands,
// raised in the other claw too while he cheers.
function armsAt(t: number) {
  const facing = facingAt(t)
  if (isCheering(t)) return { left: 'up', right: 'up' } as const

  return facing > 0 ? ({ left: 'down', right: 'out' } as const) : ({ left: 'out', right: 'down' } as const)
}

// The trophy in Clawd's claw: held out in front at the claw's tip, or
// raised over his shoulder while he cheers.
function drawTrophy(b: PixelBuffer, t: number) {
  const x = clawdX(t, areaOf(b))
  const facing = facingAt(t)
  if (isCheering(t)) {
    const side = facing > 0 ? x + CLAWD_W - 3 : x - 2
    drawSprite(b, TROPHY, 0, side, CLAWD_TOP - 3)

    return
  }
  // The claw's tip, held out: 2 columns past the body on its side.
  const tip = facing > 0 ? x + CLAWD_W + 1 : x - 2
  const bob = isRunning(t) && every(t, 0.12) % 2 === 1 ? 1 : 0
  drawSprite(b, TROPHY, 0, tip - 2, CLAWD_TOP - 1 + bob)
}

export const victoryLap: Scene = {
  id: 'victory-lap',
  loop: LOOP,
  still: 6.6,
  focusX: START_X + 7,
  // The camera follows Clawd round the lap.
  focus: (t, area) => clawdX(t, area) + 7,
  backdrop: (b, t) => {
    drawBunting(b, t)
    drawStands(b, t)
    drawTrack(b)
  },
  actors: [
    // Behind Clawd, so his claw grips it in front.
    { kind: 'prop', z: -1, draw: drawTrophy },
    {
      kind: 'clawd',
      isHero: true,
      at: (t, area) => ({ x: clawdX(t, area), y: CLAWD_TOP }),
      look: t => ({
        pose: isRunning(t) ? 'walk' : 'stand',
        stride: every(t, 0.09),
        facing: facingAt(t),
        eyes: isCheering(t) ? 'wide' : 'open',
        isBlinking: !isRunning(t) && !isCheering(t) && blinking(t, 0.6),
        look: { x: facingAt(t), y: isCheering(t) ? -1 : 0 },
        arms: armsAt(t),
      }),
    },
  ],
}
