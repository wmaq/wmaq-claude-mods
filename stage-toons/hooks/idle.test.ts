import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK } from './clawd'
import { CLAWD_X, DOZE_MS, IDLE_COLS, IDLE_IDS, IDLE_ROWS, idleFrame, pickIdle, ROUTINES, Z_COLOR } from './idle'
import type { PixelBuffer } from './pixels'

const at = (seconds: number, routine = 'classic') => idleFrame(routine, seconds * 1000)
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
const eyeRows = (b: PixelBuffer) => [...new Set(where(b, EYE_DARK).map(p => p.y))].sort()

test('the idle frame is 26 columns by 4 rows, 8 pixels tall', () => {
  expect([IDLE_COLS, IDLE_ROWS, CLAWD_X]).toEqual([26, 4, 12])
  const b = at(0)
  expect([b.w, b.h]).toEqual([26, 8])
})

test('every routine keeps Clawd at the right edge, whole, at every moment', () => {
  for (const id of IDLE_IDS) {
    for (let t = 0; t < 59.9; t += 0.1) {
      const orange = where(at(t, id), CLAWD_ORANGE)
      expect(orange.length).toBeGreaterThan(40)
      expect(Math.min(...orange.map(p => p.x))).toBeGreaterThanOrEqual(CLAWD_X - 1)
    }
  }
})

test('classic: Clawd stands with open eyes, feet on the bottom row', () => {
  const b = at(0.5)
  expect(where(b, CLAWD_ORANGE).some(p => p.y === 7)).toBe(true)
  expect(eyeRows(b)).toEqual([2, 3])
  expect(where(b, Z_COLOR)).toHaveLength(0)
})

test('classic: Clawd blinks, glances down at the prompt and right at the bar', () => {
  expect(eyeRows(at(0.05))).toEqual([3])
  expect(eyeRows(at(2.5))).toEqual([3, 4])
  const ahead = where(at(0.5), EYE_DARK).map(p => p.x)
  const right = where(at(4), EYE_DARK).map(p => p.x)
  expect(right).toEqual(ahead.map(x => x + 1))
})

test('classic: Clawd taps a foot now and then, and loops every 8 seconds', () => {
  const feet = (b: PixelBuffer) => JSON.stringify(where(b, CLAWD_ORANGE).filter(p => p.y >= 6))
  expect(feet(at(5.1))).not.toBe(feet(at(5.3)))
  expect(feet(at(0.5))).toBe(feet(at(1.5)))
  expect([...at(8.5).px]).toEqual([...at(0.5).px])
})

test('after a minute every routine dozes the same way: sitting, eyes closed, z rising at his left', () => {
  expect(DOZE_MS).toBe(60_000)
  for (const id of IDLE_IDS) expect([...at(61, id).px]).toEqual([...at(61).px])
  expect(where(at(59.9), Z_COLOR)).toHaveLength(0)
  const b = at(61)
  expect(where(b, CLAWD_ORANGE).some(p => p.y < 2)).toBe(false)
  expect(eyeRows(b)).toEqual([5])
  const z = where(b, Z_COLOR)
  expect(z.length).toBeGreaterThan(0)
  expect(z.every(p => p.x >= 8 && p.x <= 10)).toBe(true)
})

test("one z rises at a time, whole, and they rise", () => {
  const tops = new Set<number>()
  for (let t = 60; t < 70; t += 0.05) {
    const z = where(at(t), Z_COLOR)
    expect(z.length % 7).toBe(0)
    expect(z.length).toBeLessThanOrEqual(7)
    if (z.length > 0) tops.add(Math.min(...z.map(p => p.y)))
  }
  expect(tops.size).toBeGreaterThan(2)
})

test('the routine is picked like a scene: never the last one when there is another', () => {
  for (const id of IDLE_IDS) expect(IDLE_IDS).toContain(pickIdle(id, 0.5))
  if (IDLE_IDS.length > 1) for (const id of IDLE_IDS) expect(pickIdle(id, 0.5)).not.toBe(id)
})

test('an unknown routine draws classic; one that throws is replaced by classic and reported once', () => {
  expect([...at(1, 'gone').px]).toEqual([...at(1).px])
  ROUTINES.boom = { id: 'boom', loop: 1, draw: () => { throw new Error('bang') } }
  try {
    const broken = new Set<string>()
    const reports: string[] = []
    const onBreak = (id: string) => reports.push(id)
    expect([...idleFrame('boom', 1000, broken, onBreak).px]).toEqual([...at(1).px])
    expect([...idleFrame('boom', 1100, broken, onBreak).px]).toEqual([...at(1.1).px])
    expect(reports).toEqual(['boom'])
  } finally {
    delete ROUTINES.boom
  }
})
