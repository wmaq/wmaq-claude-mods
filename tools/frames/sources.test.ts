import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hex } from '../../stage-toons/hooks/pixels'
import { STAGE_SIZE } from '../../stage-toons/hooks/scene'
import { HELPER_COLORS } from '../../stage-toons/hooks/waiting'
import { WATER } from '../../stage-toons/hooks/waiting/rowing'
import { CELL_H, CELL_W, type Canvas } from './grid'
import { SCENES } from '../../stage-toons/hooks/scenes'
import { WAITING_SCENE_IDS } from '../../stage-toons/hooks/waiting/deal'
import { bandFrames, djFrames, idleFrames, sceneFrames, stillFrames, turnFrames, waitingFrames, workDemoFrames } from './sources'

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
  assert.throws(() => waitingFrames(['fable'], [0], STAGE_SIZE, 'sailing'), /unknown waiting scene "sailing"; known: laptops, building, rowing, conveyor/)
})

test('waiting draws the scene asked for, and --demo the demo\'s script over it', () => {
  const [rowing] = waitingFrames(['fable'], [3000], STAGE_SIZE, 'rowing')
  const [laptops] = waitingFrames(['fable'], [3000])
  assert.ok(has(rowing!, WATER))
  assert.ok(!has(laptops!, WATER))
  const [early, full] = waitingFrames('demo', [500, 9000], STAGE_SIZE, 'conveyor')
  assert.ok(!has(early!, HELPER_COLORS.haiku))
  for (const kind of ['sonnet', 'opus', 'fable', 'haiku'] as const) assert.ok(has(full!, HELPER_COLORS[kind]))
})

test("dj draws Clawd DJ: the agents' helpers dancing, and the demo's script; --demo takes no other option", () => {
  const WIDE = { columns: 120, rows: 9 }
  const [dancing] = djFrames({ agents: ['sonnet'] }, [3000], WIDE)
  const [alone] = djFrames({}, [3000], WIDE)
  assert.ok(has(dancing!, HELPER_COLORS.sonnet))
  assert.ok(!has(alone!, HELPER_COLORS.sonnet))
  const [demo] = djFrames({ demo: true }, [3000], WIDE)
  assert.ok(has(demo!, HELPER_COLORS.fable))
  assert.throws(() => djFrames({ demo: true, calm: true }, [0]), /dj --demo plays its own script/)
})

test("the waiting toon seats Fable's helper at the desk row, in violet", () => {
  const [frame] = waitingFrames(['fable'], [2000])
  assert.ok(has(frame!, HELPER_COLORS.fable))
})

test('a scene is as wide and as tall as asked, 48 by 7 when not', () => {
  const [frame] = sceneFrames('bricklaying', {}, [0], { columns: 40, rows: 7 })
  assert.deepEqual([frame!.cols, frame!.rows], [40, 7])
  const [wide] = sceneFrames('bricklaying', {}, [0], { columns: 120, rows: 9 })
  assert.deepEqual([wide!.cols, wide!.rows], [120, 9])
  const [plain] = sceneFrames('bricklaying', {}, [0])
  assert.deepEqual([plain!.cols, plain!.rows], [48, 7])
})

test("the band at Plan shows the bar's done colour at its first step, with the area under the bar", () => {
  const [frame] = bandFrames({ stage: 'plan', columns: 100 }, [0])
  // The bar's one-cell margin, then the first step.
  assert.ok(!inCell(frame!, 0, 0, hex('#D97757')))
  assert.ok(inCell(frame!, 1, 0, hex('#D97757')))
  assert.equal(frame!.cols, 100)
  assert.equal(frame!.rows, 2 + 9)
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
  assert.equal(working!.rows, 2 + 9)
  const [busy] = bandFrames({ stage: 'plan', columns: 100, working: true, agents: ['fable'], idle: 'celebrate' }, [500])
  assert.deepEqual(busy!.px, working!.px)
  const [idle] = bandFrames({ stage: 'plan', columns: 100 }, [500])
  assert.notDeepEqual(idle!.px, working!.px)
})

test('a working band plays the scene asked for, the same as the scene command draws it', () => {
  const [band] = bandFrames({ stage: 'plan', columns: 100, working: true, scene: 'dice' }, [1500])
  // The area is 99 wide (the band's 100, one spare) and 9 rows, under the
  // bar's two.
  const [scene] = sceneFrames('dice', {}, [1500], { columns: 99, rows: 9 })
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
  assert.equal(celebrating!.rows, 2 + 9)
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

test("the band's area follows the width setting and the band's rows", () => {
  const [wide] = bandFrames({ stage: 'plan', columns: 200 }, [0])
  assert.deepEqual([wide!.cols, wide!.rows], [200, 2 + 9])
  const [narrowed] = bandFrames({ stage: 'plan', columns: 200, width: 80, maxRows: 2 + 8 }, [0])
  assert.deepEqual([narrowed!.cols, narrowed!.rows], [200, 2 + 8])
  // The area's 80 columns: nothing of it right of them.
  for (let row = 2; row < narrowed!.rows; row++) for (let col = 80; col < 200; col++) assert.ok(!inCell(narrowed!, col, row, hex('#D97757')))
  const [full] = bandFrames({ stage: 'plan', columns: 600, width: 'full' }, [0])
  assert.equal(full!.cols, 600)
})

test('calm mode draws the same frame over time, but for a change: a turn dissolves from the idle still to the scene\'s and back', () => {
  const same = (frames: Canvas[]) => frames.every(f => f.px.every((p, i) => p === frames[0]!.px[i]))
  assert.ok(same(sceneFrames('bricklaying', { calm: true }, [0, 1000, 5000, 9000], STAGE_SIZE)))
  assert.ok(same(idleFrames('yo-yo', false, [0, 1000, 3000], STAGE_SIZE, true)))
  // The second helper sits down at 500 ms: the picture dissolves to it at the next draw (1000), then holds.
  assert.ok(same(waitingFrames(['fable', 'opus'], [1000, 6000, 9000, 12000], STAGE_SIZE, 'rowing', true).slice(1)))
  assert.ok(!same(sceneFrames('bricklaying', {}, [0, 1000], STAGE_SIZE)))
  const turn = turnFrames({ stage: 'develop', calm: true }, [500, 1250, 3000, 4000, 5250, 6000], STAGE_SIZE)
  assert.ok(same([turn[2]!, turn[3]!]))
  assert.ok(!same([turn[0]!, turn[1]!]))
  assert.ok(!same([turn[1]!, turn[2]!]))
  assert.ok(!same([turn[3]!, turn[4]!]))
})

test("stills draws every picture's still, captioned with its id", () => {
  assert.deepEqual(stillFrames('scenes').captions, Object.keys(SCENES))
  assert.deepEqual(stillFrames('waiting').captions, [...WAITING_SCENE_IDS])
  const idle = stillFrames('idle').captions
  for (const id of ['classic', 'nyan', 'coffee', 'reading', 'yo-yo', 'celebrate', 'show-off:roadmap', 'show-off:cleanup', 'doze']) assert.ok(idle.includes(id), id)
  assert.throws(() => stillFrames('props'), /unknown stills kind "props"/)
})
