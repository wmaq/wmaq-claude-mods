import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hex } from '../../stage-toons/hooks/pixels'
import { HELPER_COLORS } from '../../stage-toons/hooks/waiting'
import { WATER } from '../../stage-toons/hooks/waiting/rowing'
import { CELL_H, CELL_W, type Canvas } from './grid'
import { bandFrames, idleFrames, sceneFrames, turnFrames, waitingFrames, workDemoFrames } from './sources'

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
  assert.throws(() => waitingFrames(['fable'], [0], 48, 'sailing'), /unknown waiting scene "sailing"; known: laptops, building, rowing, conveyor/)
})

test('waiting draws the scene asked for, and --demo the demo\'s script over it', () => {
  const [rowing] = waitingFrames(['fable'], [3000], 48, 'rowing')
  const [laptops] = waitingFrames(['fable'], [3000])
  assert.ok(has(rowing!, WATER))
  assert.ok(!has(laptops!, WATER))
  const [early, full] = waitingFrames('demo', [500, 9000], 48, 'conveyor')
  assert.ok(!has(early!, HELPER_COLORS.haiku))
  for (const kind of ['sonnet', 'opus', 'fable', 'haiku'] as const) assert.ok(has(full!, HELPER_COLORS[kind]))
})

test("the waiting toon seats Fable's helper at the desk row, in violet", () => {
  const [frame] = waitingFrames(['fable'], [2000])
  assert.ok(has(frame!, HELPER_COLORS.fable))
})

test('a scene is as wide as asked, by the area’s rows', () => {
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

test("the work demo draws its steps' layer over the stage's scene; its scene is the stage's first, or --scene's", () => {
  const [thinking, searching] = workDemoFrames({ stage: 'develop' }, [1500, 4500])
  assert.notDeepEqual(thinking!.px, searching!.px)
  assert.equal(searching!.cols, 48)
  const [dice] = workDemoFrames({ stage: 'develop', scene: 'dice' }, [4500])
  assert.notDeepEqual(dice!.px, searching!.px)
  assert.throws(() => workDemoFrames({ scene: 'nope' }, [0]), /unknown scene "nope"/)
})

test("the band's bar shows Claude's tasks when given", () => {
  const [plain] = bandFrames({ stage: 'plan', columns: 100 }, [0])
  const [tasks] = bandFrames({ stage: 'plan', columns: 100, tasks: { done: 3, total: 8 } }, [0])
  assert.notDeepEqual(tasks!.px, plain!.px)
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

test('a turn: the idle Clawd, a dissolve into the scene at the start, the scene, a dissolve back at the end', () => {
  const [idle, startFade, scene, endFade, after] = turnFrames({ scene: 'dice' }, [500, 1250, 3000, 5250, 6000])
  const same = (a: Canvas, b: Canvas) => a.px.every((v, i) => v === b.px[i])
  assert.ok(same(idle!, idleFrames('classic', false, [500])[0]!))
  // Halfway through each dissolve, the frame is neither picture.
  const sceneAt = (ms: number) => sceneFrames('dice', {}, [ms])[0]!
  const idleAt = (ms: number) => idleFrames('classic', false, [ms])[0]!
  assert.ok(!same(startFade!, sceneAt(250)))
  assert.ok(!same(startFade!, idleAt(1250)))
  assert.ok(!same(endFade!, sceneAt(4250)))
  assert.ok(!same(endFade!, idleAt(250)))
  // The scene came on at the turn's start, from its beginning.
  assert.ok(same(scene!, sceneAt(2000)))
  // After the end, the idle Clawd again, his idle period from the turn's end.
  assert.ok(same(after!, idleFrames('classic', false, [1000])[0]!))
})

test("a turn's options are checked", () => {
  assert.throws(() => turnFrames({ scene: 'nope' }, [0]), /unknown scene "nope"/)
  assert.throws(() => turnFrames({ stage: 'nope' }, [0]), /unknown stage "nope"/)
  assert.throws(() => turnFrames({ idle: 'nope' }, [0]), /unknown idle routine "nope"/)
  assert.throws(() => turnFrames({ start: 3000, end: 2000 }, [0]), /--end \(2000\) is before --start \(3000\)/)
})

test("a scene sampled across a fading scene's loop point shows the seam's dissolve", () => {
  // sweeping loops at 8 s and fades there.
  const [before, seam, after] = sceneFrames('sweeping', {}, [7900, 8250, 8600])
  const alone = sceneFrames('sweeping', {}, [8600])
  assert.ok(seam!.px.some((v, i) => v !== before!.px[i]))
  assert.ok(seam!.px.some((v, i) => v !== after!.px[i]))
  assert.deepEqual(after!.px, alone[0]!.px)
})

test('a scene with --phase, --what, --say and --mode draws the layer over it, held for the sheet', () => {
  const plain = sceneFrames('workbench', {}, [500, 4000])
  const badge = sceneFrames('workbench', { phase: 'test', what: 'npm test' }, [500, 4000])
  for (const [i, frame] of badge.entries()) assert.notDeepEqual(frame.px, plain[i]!.px)
  const line = sceneFrames('workbench', { say: 'All green!' }, [500, 4000])
  assert.ok(has(line[1]!, hex('#F2EAD8')))
  const thinking = sceneFrames('workbench', { mode: 'thinking' }, [500])
  assert.notDeepEqual(thinking[0]!.px, plain[0]!.px)
  assert.throws(() => sceneFrames('workbench', { phase: 'dancing' }, [0]), /unknown phase "dancing"; known: search, read/)
  assert.throws(() => sceneFrames('workbench', { mode: 'sleeping' as never }, [0]), /unknown mode "sleeping"/)
})
