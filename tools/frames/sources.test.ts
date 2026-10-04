import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hex } from '../../stage-toons/hooks/pixels'
import { HELPER_COLORS } from '../../stage-toons/hooks/waiting'
import { CELL_H, CELL_W, type Canvas } from './grid'
import { bandFrames, idleFrames, sceneFrames, waitingFrames } from './sources'

const has = (c: Canvas, colour: number) => c.px.includes(colour)

// Whether a colour shows in one cell of a canvas.
function inCell(c: Canvas, col: number, row: number, colour: number): boolean {
  for (let y = row * CELL_H; y < (row + 1) * CELL_H; y++) {
    for (let x = col * CELL_W; x < (col + 1) * CELL_W; x++) if (c.px[y * c.width + x] === colour) return true
  }

  return false
}

test('the same request gives the same pixels', () => {
  const twice = () => [sceneFrames('bricklaying', {}, [0, 1500]), idleFrames('classic', false, [2000]), waitingFrames(['fable'], [2000])]
  const [a, b] = [twice(), twice()]
  a.forEach((frames, i) => frames.forEach((f, j) => assert.deepEqual(f.px, b[i]![j]!.px)))
})

test('an unknown id is an error that lists the known ones', () => {
  assert.throws(() => sceneFrames('no-such-scene', {}, [0]), /unknown scene "no-such-scene"; known: .*bricklaying/)
  assert.throws(() => idleFrames('nope', false, [0]), /unknown idle routine "nope"; known: .*classic/)
  assert.throws(() => bandFrames({ stage: 'nope' }, [0]), /unknown stage "nope"; known: roadmap, brainstorm/)
  assert.throws(() => waitingFrames([], [0]), /waiting needs --agents/)
})

test("the waiting toon seats Fable's helper at the desk row, in violet", () => {
  const [frame] = waitingFrames(['fable'], [2000])
  assert.ok(has(frame!, HELPER_COLORS.fable))
})

test('a scene is the toon width by its rows', () => {
  const [frame] = sceneFrames('bricklaying', { width: 40 }, [0])
  assert.equal(frame!.cols, 40)
  assert.equal(frame!.rows, 7)
})

test("the band at Plan shows the bar's done colour at its first step, with the area under the bar", () => {
  const [frame] = bandFrames({ stage: 'plan', columns: 100 }, [0])
  // The bar's one-cell margin, then the first step.
  assert.ok(!inCell(frame!, 0, 0, hex('#D97757')))
  assert.ok(inCell(frame!, 1, 0, hex('#D97757')))
  assert.equal(frame!.cols, 100)
  assert.equal(frame!.rows, 2 + 7)
})

test('a working band is the bar alone; agents then change nothing', () => {
  const [frame] = bandFrames({ stage: 'plan', columns: 100, working: true, agents: ['fable'] }, [0])
  assert.equal(frame!.rows, 2)
})
