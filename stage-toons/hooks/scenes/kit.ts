// What the scenes share: a palette for props (never Clawd's orange or
// Fable's violet, so the two Clawds stand out), timing helpers, and small
// sprites. In a sprite, '.' is transparent and each other letter is a
// palette color. A scene draws in the core's coordinates; rightOf(b) and
// topOf(b) are the area's edges, for a set that runs on to them.

import { fillRect, type PixelBuffer, type Point, rightOf, setPixel, topOf } from '../pixels'
import type { Sprite } from '../scene'

export const C = {
  ink: 0x2a1610,
  paper: 0xf2ead8,
  paperShade: 0xc9bfa8,
  wood: 0x9a6a45,
  woodDark: 0x5e3b25,
  gold: 0xf2c14e,
  bulbOff: 0x5c5c5c,
  gray: 0x8f8f8f,
  darkGray: 0x555555,
  white: 0xffffff,
  green: 0x5bbf6a,
  red: 0xe5534b,
  blue: 0x5a8dee,
  brick: 0xb5523b,
  mortar: 0xd8c3a5,
  glass: 0xbfe3f0,
  liquid: 0x6fd08c,
  road: 0xc8a96a,
  dust: 0xb8a58a,
  smoke: 0x9e9e9e,
  // A torch's beam in the dark: a dim yellow.
  beam: 0x5f5326,
  // Brass in shade, under gold's light: the scales' spare weights.
  brassDark: 0x8c6a2c,
  // Far clouds in the sky: a muted blue-grey and its shade, well apart
  // from the white of Clawd's own thought bubbles.
  sky: 0x9fb0c2,
  skyShade: 0x7f93a8,
  // The rainbow's orange and violet: well apart from Clawd's orange and
  // Fable's violet.
  orange: 0xff8c1a,
  violet: 0xc04fc8,
} as const

// How many whole periods have passed.
export const every = (t: number, period: number): number => Math.floor(t / period)
// A short blink every few seconds; seed staggers Clawds.
export const blinking = (t: number, seed = 0): boolean => (t + seed) % 3.1 < 0.15
export const wave = (t: number, period: number): number => Math.sin((t / period) * Math.PI * 2)
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * Math.max(0, Math.min(1, k))
export const still = (x: number, y: number) => (): Point => ({ x, y })
// A straight line of pixels from (x0, y0) to (x1, y1), both ends included.
export function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, color: number): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= n; i++) setPixel(b, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color)
}

export const QMARK: Sprite = { palette: { x: C.gold }, frames: [['xx.', '..x', '.x.', '...', '.x.']] }
export const BANG: Sprite = { palette: { x: C.red }, frames: [['x', 'x', '.', 'x']] }
export const TICK: Sprite = { palette: { x: C.green }, frames: [['...x', '..x.', 'x.x.', '.x..']] }
export const BULB_ON: Sprite = { palette: { y: C.gold, g: C.gray }, frames: [['.y.', 'yyy', '.y.', '.g.']] }
export const BULB_OFF: Sprite = { palette: { y: C.bulbOff, g: C.gray }, frames: [['.y.', 'yyy', '.y.', '.g.']] }
export const FLAG: Sprite = { palette: { p: C.woodDark, f: C.red }, frames: [['pff', 'pf.', 'p..', 'p..']] }
export const PAGE: Sprite = { palette: { w: C.paper, l: C.ink }, frames: [['wwww', 'wllw', 'wwww', 'wllw', 'wwww']] }
export const CHECKLIST: Sprite = { palette: { w: C.paper, g: C.green, l: C.ink }, frames: [['wwwww', 'wgwll', 'wwwww', 'wgwll', 'wwwww']] }
export const SCROLL: Sprite = {
  palette: { w: C.paper, s: C.paperShade, l: C.ink },
  frames: [['swwwwws', 'swllwws', 'swwwwws', 'swlllws', 'swwwwws']],
}
export const GLASS: Sprite = { palette: { r: C.gray, g: C.glass, h: C.woodDark }, frames: [['.rr..', 'rggr.', 'rggr.', '.rrh.', '....h']] }
export const STONE: Sprite = { palette: { s: C.gray, d: C.darkGray }, frames: [['.ss.', 'dddd']] }
export const BRICK: Sprite = { palette: { b: C.brick, m: C.mortar }, frames: [['bbbm', 'bbbm']] }
export const TUBE: Sprite = { palette: { g: C.glass, l: C.liquid }, frames: [['g.g', 'g.g', 'g.g', 'glg', 'glg', 'glg', '.g.']] }
export const GIFT: Sprite = { palette: { r: C.red, y: C.gold }, frames: [['.y..y.', 'yyyyyy', 'rrryrr', 'rrryrr', 'rrryrr', 'rrryrr']] }
export const BROOM: Sprite = { palette: { w: C.wood, b: C.gold }, frames: [['..w', '..w', '.w.', '.w.', 'bbb', 'bbb']] }
export const BOX: Sprite = {
  palette: { b: C.wood, d: C.woodDark },
  frames: [['ddddddddd', 'dbbbbbbbd', 'dbbbbbbbd', 'dbbbbbbbd', 'dbbbbbbbd', 'dbbbbbbbd', 'ddddddddd']],
}

// A plank run on to the area's right edge: the wood top from column from,
// and a woodDark leg legH tall under it at legAt and every step columns
// after it. A scene keeps its own core plank and legs and continues them
// with this from its right leg.
export function plankOn(b: PixelBuffer, from: number, y: number, legH: number, legAt: number, step: number): void {
  const edge = rightOf(b)
  if (from < edge) fillRect(b, from, y, edge - from, 1, C.wood)
  for (let x = legAt; x < edge; x += step) fillRect(b, x, y + 1, 1, legH, C.woodDark)
}

// A starfield in up to three depths, drifting right to left at different
// speeds (parallax): far stars dim and slow, near stars white, fast and
// twinkling. Each depth is a fixed 48 x 14 scatter, tiled across the
// area's width and up into its headroom (each tile above shifted by half a
// tile, so the tiles' columns don't line up); every star wraps round the
// area's own width. time is unwrapped (a background's), so the stars never
// jump back. On a 48 x 14 area it is the one scatter, as it was.
export type StarLayer = 'far' | 'middle' | 'near'
const TILE_W = 48
const TILE_H = 14
export const STAR_LAYERS: Record<StarLayer, { color: number; speed: number; stars: readonly Point[] }> = {
  far: {
    color: C.darkGray,
    speed: 2,
    stars: [
      { x: 3, y: 1 },
      { x: 11, y: 4 },
      { x: 19, y: 0 },
      { x: 26, y: 3 },
      { x: 33, y: 6 },
      { x: 41, y: 2 },
      { x: 46, y: 5 },
      { x: 7, y: 9 },
      { x: 15, y: 12 },
      { x: 29, y: 10 },
      { x: 38, y: 13 },
      { x: 44, y: 8 },
    ],
  },
  middle: {
    color: C.paperShade,
    speed: 4,
    stars: [
      { x: 6, y: 6 },
      { x: 14, y: 2 },
      { x: 23, y: 8 },
      { x: 31, y: 1 },
      { x: 36, y: 11 },
      { x: 43, y: 4 },
      { x: 2, y: 12 },
    ],
  },
  near: {
    color: C.white,
    speed: 6,
    stars: [
      { x: 9, y: 3 },
      { x: 21, y: 11 },
      { x: 34, y: 7 },
      { x: 45, y: 0 },
      { x: 27, y: 13 },
    ],
  },
}

export function drawStarfield(b: PixelBuffer, time: number, layers: readonly StarLayer[]): void {
  // In the buffer's own columns: the area's left edge is column 0.
  const left = rightOf(b) - b.w
  for (const layer of layers) {
    const { color, speed, stars } = STAR_LAYERS[layer]
    for (let row = 0; -row * TILE_H + TILE_H > topOf(b); row++) {
      for (let tile = row % 2 === 0 ? 0 : -1; tile * TILE_W < b.w; tile++) {
        stars.forEach((s, i) => {
          const from = s.x + tile * TILE_W + (row % 2) * (TILE_W / 2)
          if (from < 0 || from >= b.w) return
          // Near stars twinkle: half of them show at a time, trading every 0.25 s.
          if (layer === 'near' && (((every(time, 0.25) + i + tile + row) % 2) + 2) % 2 === 1) return
          const x = Math.floor((((from - time * speed) % b.w) + b.w) % b.w)
          setPixel(b, left + x, s.y - row * TILE_H, color)
        })
      }
    }
  }
}
