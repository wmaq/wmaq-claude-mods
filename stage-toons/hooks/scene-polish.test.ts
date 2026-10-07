import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK, FABLE_VIOLET } from './clawd'
import { LAYER_CLEAR_Y } from './frames'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, areaFor, heroAt, renderFull, renderScene, renderSeamed, type Scene, stillOf } from './scene'
import { SCENES } from './scenes'
import { LAYERS as BRICK_LAYERS } from './scenes/bricklaying'
import { C, STAR_LAYERS } from './scenes/kit'
import { LAYERS as ROAD_LAYERS } from './scenes/road-trip'
import { popOf } from './scenes/rocket'

// Phase 6b's scenes: reworked (road-trip, bricklaying, flashlight) or new
// (rocket).
const PHASE = ['road-trip', 'bricklaying', 'flashlight', 'rocket']
const scene = (id: string): Scene => SCENES[id]!
const SIZES: AreaSize[] = [{ columns: 48, rows: 7 }, { columns: 120, rows: 7 }, { columns: 200, rows: 9 }]
const moments = (s: Scene, every = 0.1) => Array.from({ length: Math.round(s.loop / every) }, (_, i) => i * every)

// How light a colour looks (Rec. 709 luma, 0 to 255).
const luma = (c: number) => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff)

// A scene's layers alone: its background and backdrop, no actor or front.
const layersOf = (s: Scene): Scene => ({ ...s, actors: [], front: undefined })

test("the phase's scenes: the hero's head leaves the pop-ups room at every moment, on 48 and 120 columns", () => {
  for (const id of PHASE) {
    for (const size of [{ columns: 48, rows: 7 }, { columns: 120, rows: 7 }]) {
      for (const t of moments(scene(id))) {
        const y = heroAt(scene(id), t, size).y
        expect(`${id} at ${t} on ${size.columns}: ${y >= LAYER_CLEAR_Y}`).toBe(`${id} at ${t} on ${size.columns}: true`)
      }
    }
  }
})

test("the phase's scenes: Clawd stays whole on the area at every moment, at every width from 48 to 200 and at 512", () => {
  for (const id of PHASE) {
    for (const columns of [...Array.from({ length: 153 }, (_, i) => 48 + i), 512]) {
      const size = { columns, rows: 9 }
      const right = areaFor(size).right
      for (const t of moments(scene(id), 0.5)) {
        const x = heroAt(scene(id), t, size).x
        expect(`${id} at ${t} on ${columns}: ${x + 7 <= right}`).toBe(`${id} at ${t} on ${columns}: true`)
      }
    }
  }
})

test("the phase's scenes: at the still Clawd's eyes are open, on every size", () => {
  for (const id of PHASE) {
    for (const size of SIZES) {
      const b = renderFull(scene(id), stillOf(scene(id)), null, stillOf(scene(id)), size)
      expect(`${id}: ${[...b.px].filter(c => c === EYE_DARK).length >= 4}`).toBe(`${id}: true`)
    }
  }
})

test("the phase's scenes: at 30 columns the crop keeps Clawd in view through the loop", () => {
  for (const id of PHASE) {
    for (const t of moments(scene(id))) {
      const b = renderScene(scene(id), t, 30)
      expect(`${id} at ${t}: ${[...b.px].filter(c => c === CLAWD_ORANGE).length > 40}`).toBe(`${id} at ${t}: true`)
    }
  }
})

// How many pixels differ between two pictures of a size.
const changed = (a: PixelBuffer, b: PixelBuffer) => [...a.px].filter((c, i) => c !== b.px[i]).length

test("the phase's scenes: over the whole area, the step over the loop point is no bigger than any inside it", () => {
  for (const id of PHASE) {
    const s = scene(id)
    // The background held still: it drifts on unwrapped time, so it never
    // jumps; a fading scene's held last moment dissolves into its start.
    const held: Scene = { ...s, background: s.background && (b => s.background!(b, 0)) }
    for (const size of SIZES) {
      // The second loop, every 0.05 s, so the fade at its start is drawn.
      const draw = (time: number) => renderSeamed(held, time, null, size)
      const frames = Array.from({ length: Math.round(s.loop / 0.05) }, (_, i) => draw(s.loop + 0.025 + i * 0.05))
      const inside = Math.max(0, ...frames.slice(1).map((b, i) => changed(frames[i]!, b)))
      const over = changed(draw(2 * s.loop - 0.025), draw(2 * s.loop + 0.025))
      expect(`${id} at ${size.columns}: ${over} <= ${inside}: ${over <= inside}`).toBe(`${id} at ${size.columns}: ${over} <= ${inside}: true`)
    }
  }
})

test('the quiet rules: every scrolling layer drifts 6 columns a second or slower', () => {
  for (const layer of [...Object.values(ROAD_LAYERS), ...Object.values(BRICK_LAYERS)]) {
    expect(layer.speed).toBeGreaterThan(0)
    expect(layer.speed).toBeLessThanOrEqual(6)
    expect(layer.fade >= 0 && layer.fade < 1).toBe(true)
  }
})

test("the quiet rules: behind Clawd every layer is dimmer than he is, and no layer draws his orange or Fable's violet", () => {
  const stars = new Set(Object.values(STAR_LAYERS).map(l => l.color))
  for (const id of PHASE) {
    const s = scene(id)
    for (const size of SIZES) {
      for (const t of moments(s, 0.5)) {
        const b = renderFull(layersOf(s), t, null, t, size)
        expect([...b.px].some(c => c === CLAWD_ORANGE || c === FABLE_VIOLET)).toBe(false)
        // Clawd's box: 14 columns round his head's centre, from his head down.
        const head = heroAt(s, t, size)
        const ox = b.ox ?? 0
        const oy = b.oy ?? 0
        for (let y = head.y; y < 14; y++) {
          for (let x = head.x - 7; x < head.x + 7; x++) {
            const c = getPixel(b, x + ox, y + oy)
            if (c === EMPTY || stars.has(c)) continue
            expect(`${id} at ${t}, ${x},${y}: ${luma(c) < luma(CLAWD_ORANGE)}`).toBe(`${id} at ${t}, ${x},${y}: true`)
          }
        }
      }
    }
  }
})

test('the rocket pops 8 short of the edge, at most 150 columns on from its pad, high in the sky', () => {
  expect(popOf(areaFor({ columns: 48, rows: 7 }))).toEqual({ x: 40, y: 5 })
  expect(popOf(areaFor({ columns: 120, rows: 9 }))).toEqual({ x: 112, y: 1 })
  expect(popOf(areaFor({ columns: 512, rows: 9 })).x).toBe(175)
  // The flash at the pop is white, round where it pops.
  const b = renderFull(scene('rocket'), 4.85, null, 4.85, { columns: 120, rows: 9 })
  expect(getPixel(b, 112, 1 + 4)).toBe(C.white)
})
