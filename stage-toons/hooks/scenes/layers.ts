// The depth kit: scenery in layers behind the actors. A scrolling layer is
// a pattern in its own columns that repeats every period and drifts right
// to left at its speed (columns a second), in whole columns, on the
// background's unwrapped time, so it never jumps at the loop point. Far
// layers fade towards FAR, a dark terminal's background; light shows part
// of a dark room. Everything is drawn in the core's coordinates, across the
// whole area.

import { createBuffer, EMPTY, type PixelBuffer } from '../pixels'
import { areaOf } from '../scene'

// The colour far things fade towards: a dark background (the frame tool's).
// On a terminal far from it, faded layers show as dim shapes in a slightly
// different grey.
export const FAR = 0x1e1e1e

// A layer of a scene that scrolls: its speed, in columns a second, and how
// far it fades towards FAR (0 its colours, 1 gone). Each such scene exports
// its table, which the quiet rules test.
export type LayerSpec = { speed: number; fade: number }

// Where v falls in a pattern repeating every period: 0 to period - 1.
export const wrap = (v: number, period: number): number => ((v % period) + period) % period

// How far a layer has scrolled at a time: whole columns.
export const scrolled = (time: number, speed: number): number => Math.floor(time * speed)

// Every column of the area once, with its place in the pattern (0 to
// period - 1) when the layer has scrolled offset columns.
export function eachColumn(b: PixelBuffer, offset: number, period: number, draw: (x: number, u: number) => void): void {
  const { left, right } = areaOf(b)
  for (let x = left; x < right; x++) draw(x, wrap(x + offset, period))
}

// Every copy on the area of an item placed at column at of the pattern, at
// its screen column: margin columns either side of the area too, for items
// wider than a column.
export function eachItem(b: PixelBuffer, offset: number, period: number, at: number, draw: (x: number) => void, margin = 12): void {
  const { left, right } = areaOf(b)
  const from = left - margin
  for (let x = from + wrap(at - offset - from, period); x < right + margin; x += period) draw(x)
}

// Two colours mixed: k 0 is a, 1 is b.
export function mix(a: number, b: number, k: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - k) + ((b >> s) & 0xff) * k)

  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

// A colour faded with distance or dark: k 0 is the colour, 1 is FAR.
export const fade = (color: number, k: number): number => mix(color, FAR, k)

// How a lit paint shows. dark: how far an unlit pixel fades (1 gone). bare:
// the colour of the room's own wall and floor, shown in the light where the
// paint drew nothing.
export type LitOptions = { dark: number; bare?: number }

// Draws a paint into an off-screen buffer of the area's shape, then sets
// each pixel of b by how lit it is (lightAt, 0 dark to 1 lit, in the core's
// coordinates): a pixel the paint drew takes its colour, a pixel it left
// empty takes bare when given, either faded by dark × (1 − light). With dark
// 1, a pixel lit less than 0.1 is left as it was, so an unlit room is the
// terminal's own background, on any theme.
export function drawLit(b: PixelBuffer, draw: (layer: PixelBuffer) => void, lightAt: (x: number, y: number) => number, opts: LitOptions): void {
  const ox = b.ox ?? 0
  const oy = b.oy ?? 0
  const layer = createBuffer(b.w, b.h, ox, oy)
  draw(layer)
  // A light has few levels and a paint few colours: each shade is mixed once.
  const shades = new Map<string, number>()
  for (let py = 0; py < b.h; py++) {
    for (let px = 0; px < b.w; px++) {
      const i = py * b.w + px
      const color = layer.px[i] !== EMPTY ? layer.px[i]! : opts.bare
      if (color === undefined) continue
      const light = Math.max(0, Math.min(1, lightAt(px - ox, py - oy)))
      if (opts.dark >= 1 && light < 0.1) continue
      const k = opts.dark * (1 - light)
      const key = `${color}:${k}`
      let shade = shades.get(key)
      if (shade === undefined) {
        shade = fade(color, k)
        shades.set(key, shade)
      }
      b.px[i] = shade
    }
  }
}
