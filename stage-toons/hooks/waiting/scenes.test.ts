import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, type Roster, spawned } from '../agents'
import { CLAWD_ORANGE } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { CUP, HELPER_COLORS, WAITING_SCENE_IDS, waitingFrame } from '.'
import { waitingDemoAt } from './demo'
import { EMPTY_LOG, seat, type SeatLog } from './seats'

const T = 100_000
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
const inSeat = (b: PixelBuffer, color: number, seat: number) => where(b, color).filter(p => p.x >= 16 + 8 * seat && p.x < 23 + 8 * seat)

// The log with these models' agents seated, moved on in 50 ms steps to `to`.
function seated(models: readonly string[], to = T + 5000): SeatLog {
  const roster = models.reduce<Roster>((r, m, i) => spawned(r, `a${i}`, m, 0), EMPTY_ROSTER)
  let log = EMPTY_LOG
  for (let now = T; now <= to; now += 50) log = seat(log, roster, now, true).log

  return log
}

// The laptops are 0.10.0's toon, pixel for pixel: a hash of its frames over
// the waiting demo, taken on 0.10.0's code before the scenes were split.
test("the laptops draw 0.10.0's waiting toon, pixel for pixel", () => {
  let h = 0x811c9dc5
  for (let ms = 0; ms < 25_000; ms += 50) {
    const at = waitingDemoAt(T, T + ms)
    if (!('log' in at)) continue
    for (const c of waitingFrame(at.log, T + ms, 'laptops').px) h = Math.imul(h ^ (c & 0xffffff), 0x01000193) >>> 0
  }
  expect(h.toString(16)).toBe('d5201a5f')
})

test('every scene: each seated helper in its colour at its seat, Clawd aside at column 0 with his cup', () => {
  const log = seated(['sonnet', 'opus', 'fable', 'haiku'])
  for (const scene of WAITING_SCENE_IDS) {
    for (let s = 5; s < 17; s += 0.5) {
      const b = waitingFrame(log, T + s * 1000, scene)
      for (const [seat, kind] of (['sonnet', 'opus', 'fable', 'haiku'] as const).entries()) expect(inSeat(b, HELPER_COLORS[kind], seat).length).toBeGreaterThan(5)
      expect(where(b, CLAWD_ORANGE).some(p => p.x === 0)).toBe(true)
      expect(where(b, CUP).length).toBeGreaterThan(1)
    }
  }
})
