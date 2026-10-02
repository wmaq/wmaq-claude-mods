import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK } from './clawd'
import { DOZE_MS, IDLE_COLS, IDLE_ROWS, idleFrame, Z_COLOR } from './idle'
import type { PixelBuffer } from './pixels'

const at = (seconds: number) => idleFrame(seconds * 1000)
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
const eyeRows = (b: PixelBuffer) => [...new Set(where(b, EYE_DARK).map(p => p.y))].sort()

test('the idle frame is 18 columns by 4 rows, 8 pixels tall', () => {
  expect([IDLE_COLS, IDLE_ROWS]).toEqual([18, 4])
  const b = at(0)
  expect([b.w, b.h]).toEqual([18, 8])
})

test('awake, Clawd stands with open eyes, feet on the bottom row', () => {
  const b = at(0.5)
  expect(where(b, CLAWD_ORANGE).length).toBeGreaterThan(40)
  expect(where(b, CLAWD_ORANGE).some(p => p.y === 7)).toBe(true)
  expect(eyeRows(b)).toEqual([2, 3])
  expect(where(b, Z_COLOR)).toHaveLength(0)
})

test('awake, Clawd blinks, glances down at the prompt and right at the bar', () => {
  expect(eyeRows(at(0.05))).toEqual([3])
  expect(eyeRows(at(2.5))).toEqual([3, 4])
  const ahead = where(at(0.5), EYE_DARK).map(p => p.x)
  const right = where(at(4), EYE_DARK).map(p => p.x)
  expect(right).toEqual(ahead.map(x => x + 1))
})

test('awake, Clawd taps a foot now and then', () => {
  const feet = (b: PixelBuffer) => JSON.stringify(where(b, CLAWD_ORANGE).filter(p => p.y >= 6))
  expect(feet(at(5.1))).not.toBe(feet(at(5.3)))
  expect(feet(at(0.5))).toBe(feet(at(1.5)))
})

test('the awake loop repeats every 8 seconds', () => {
  expect([...at(8.5).px]).toEqual([...at(0.5).px])
})

test('after a minute Clawd dozes: sitting, eyes closed, z rising beside the head', () => {
  expect(DOZE_MS).toBe(60_000)
  expect(where(at(59.9), Z_COLOR)).toHaveLength(0)
  const b = at(61)
  expect(where(b, CLAWD_ORANGE).some(p => p.y < 2)).toBe(false)
  expect(eyeRows(b)).toEqual([5])
  expect(where(b, Z_COLOR).length).toBeGreaterThan(0)
  expect(where(b, Z_COLOR).every(p => p.x >= 15)).toBe(true)
})

test("the z's come one after another", () => {
  expect(where(at(60.1), Z_COLOR)).toHaveLength(7)
  expect(where(at(61.1), Z_COLOR)).toHaveLength(14)
})

test("the z's rise and are always drawn whole", () => {
  const tops = new Set<number>()
  for (let t = 60; t < 70; t += 0.1) {
    const z = where(at(t), Z_COLOR)
    expect(z.length % 7).toBe(0)
    if (z.length > 0) tops.add(Math.min(...z.map(p => p.y)))
  }
  expect(tops.size).toBeGreaterThan(2)
})
