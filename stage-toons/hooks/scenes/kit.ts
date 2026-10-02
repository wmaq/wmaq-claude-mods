// What the scenes share: a palette for props (never Clawd's orange or
// Fable's violet, so the two Clawds stand out), timing helpers, and small
// sprites. In a sprite, '.' is transparent and each other letter is a
// palette color.

import type { Point } from '../pixels'
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
} as const

// How many whole periods have passed.
export const every = (t: number, period: number): number => Math.floor(t / period)
// A short blink every few seconds; seed staggers Clawds.
export const blinking = (t: number, seed = 0): boolean => (t + seed) % 3.1 < 0.15
export const wave = (t: number, period: number): number => Math.sin((t / period) * Math.PI * 2)
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * Math.max(0, Math.min(1, k))
export const still = (x: number, y: number) => (): Point => ({ x, y })

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
