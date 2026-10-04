import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { AREA_H, HELPER_COLORS, waitingFrame } from '.'
import { WAITING_DEMO_MS, waitingDemoAt } from './demo'
import { AREA_W, CLAWD_HOME, clawdX, freesAt } from './seats'

const T = 100_000
const count = (b: PixelBuffer, color: number) => [...b.px].filter(c => c === color).length

test('every frame of the demo stays inside the area with Clawd in it, and the demo ends in the idle routine', () => {
  for (let ms = 0; ms < WAITING_DEMO_MS; ms += 100) {
    const at = waitingDemoAt(T, T + ms)
    if ('log' in at) {
      const b = waitingFrame(at.log, T + ms)
      expect(b.px.length).toBe(AREA_W * AREA_H)
      expect(count(b, CLAWD_ORANGE)).toBeGreaterThan(30)
    }
  }
  const tail = waitingDemoAt(T, T + WAITING_DEMO_MS - 1)
  expect('idleMs' in tail && tail.idleMs > 2_000).toBe(true)
})

test('four helpers of each known model sit at once; the fifth, unknown, takes the first seat freed', () => {
  const at = waitingDemoAt(T, T + 9_000)
  if (!('log' in at)) throw new Error('the demo should still be waiting at 9 s')
  expect(at.log.entries.filter(e => e.arrivedAt <= T + 9_000)).toHaveLength(4)
  const b = waitingFrame(at.log, T + 9_000)
  for (const kind of ['sonnet', 'opus', 'fable', 'haiku'] as const) expect(count(b, HELPER_COLORS[kind])).toBeGreaterThan(0)
  expect(count(b, HELPER_COLORS.unknown)).toBe(0)
  const fifth = at.log.entries[4]!
  expect(fifth.kind).toBe('unknown')
  expect(fifth.arrivedAt).toBe(freesAt(at.log.entries[0]!))
  expect(count(waitingFrame(at.log, fifth.arrivedAt + 2_000), HELPER_COLORS.unknown)).toBeGreaterThan(0)
})

test('Clawd walks back home before the idle routine takes over', () => {
  const tail = waitingDemoAt(T, T + 21_000)
  if (!('log' in tail)) throw new Error('Clawd should still be walking back at 21 s')
  expect(clawdX(tail.log, T + 21_000)).toBeGreaterThan(0)
  expect(clawdX(tail.log, T + 21_000)).toBeLessThan(CLAWD_HOME)
})
