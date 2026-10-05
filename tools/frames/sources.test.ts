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
  assert.throws(() => idleFrames('nope', false, [0]), /unknown idle routine "nope"; known: .*classic.*, celebrate, show-off:<stage>/)
  assert.throws(() => bandFrames({ stage: 'plan', idle: 'nope' }, [0]), /unknown idle routine "nope"/)
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

test("a working band draws the stage's scene under the bar; agents and the idle routine then change nothing", () => {
  const [working] = bandFrames({ stage: 'plan', columns: 100, working: true }, [500])
  assert.equal(working!.rows, 2 + 7)
  const [busy] = bandFrames({ stage: 'plan', columns: 100, working: true, agents: ['fable'], idle: 'celebrate' }, [500])
  assert.deepEqual(busy!.px, working!.px)
  const [idle] = bandFrames({ stage: 'plan', columns: 100 }, [500])
  assert.notDeepEqual(idle!.px, working!.px)
})

test('a working band plays the scene asked for, the same as the scene command draws it', () => {
  const [band] = bandFrames({ stage: 'plan', columns: 100, working: true, scene: 'dice' }, [1500])
  const [scene] = sceneFrames('dice', {}, [1500])
  // The area is 48 wide, its rows under the bar's two.
  for (let y = 0; y < scene!.height; y++) {
    for (let x = 0; x < scene!.width; x++) assert.equal(band!.px[(y + 2 * CELL_H) * band!.width + x], scene!.px[y * scene!.width + x])
  }
  assert.throws(() => bandFrames({ stage: 'plan', working: true, scene: 'nope' }, [0]), /unknown scene "nope"/)
})

test("the celebration and any stage's show-off draw as idle routines", () => {
  for (const routine of ['celebrate', 'show-off:spec', 'show-off:custom-id']) {
    const [frame] = idleFrames(routine, false, [500])
    assert.ok(has(frame!, hex('#D97757')))
  }
  assert.notDeepEqual(idleFrames('show-off:spec', false, [500])[0]!.px, idleFrames('classic', false, [500])[0]!.px)
})

test('the band in Done draws with the idle routine asked for under it', () => {
  const [classic] = bandFrames({ stage: 'done', columns: 100 }, [500])
  const [celebrating] = bandFrames({ stage: 'done', columns: 100, idle: 'celebrate' }, [500])
  assert.equal(celebrating!.rows, 2 + 7)
  assert.notDeepEqual(celebrating!.px, classic!.px)
})
