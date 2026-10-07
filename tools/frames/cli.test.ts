import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { main, parseArgs } from './cli'

const dir = mkdtempSync(join(tmpdir(), 'frames-'))
after(() => rmSync(dir, { recursive: true, force: true }))
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

// Each command writes a PNG of the size its sheet takes: two frames side by
// side, each frame's cells plus a caption row, a one-cell gap around them.
test('each command writes a PNG of its sheet', () => {
  const cases: [string[], number, number][] = [
    [['scene', 'bricklaying'], 2 * (120 + 1) + 1, 9 + 1 + 2],
    [['idle', 'classic', '--doze'], 2 * (120 + 1) + 1, 9 + 1 + 2],
    [['waiting', '--agents', 'fable,opus'], 2 * (120 + 1) + 1, 9 + 1 + 2],
    [['band', '--stage', 'plan', '--columns', '80'], 2 * (80 + 1) + 1, 2 + 9 + 1 + 2],
  ]
  for (const [args, cols, rows] of cases) {
    const out = join(dir, `${args[0]}.png`)
    const result = main([...args, '--count', '2', '--columns-per-row', '2', '--out', out])
    assert.deepEqual(result, { path: out, width: cols * 8, height: rows * 16 })
    assert.deepEqual([...readFileSync(out).subarray(0, 4)], SIGNATURE)
  }
})

test('--scale multiplies the size', () => {
  const out = join(dir, 'scaled.png')
  const result = main(['scene', 'bricklaying', '--count', '1', '--scale', '2', '--out', out])
  assert.equal(result.width, 2 * (120 + 2) * 8)
})

test('the command line reads an id, flags and values', () => {
  const args = parseArgs(['scene', 'dice', '--auditing', '--every', '100'])
  assert.equal(args.what, 'scene')
  assert.equal(args.id, 'dice')
  assert.equal(args.opts.get('auditing'), 'true')
  assert.equal(args.opts.get('every'), '100')
  assert.throws(() => parseArgs(['scene', '--every']), /--every needs a value/)
  assert.throws(() => main(['paint', 'x']), /unknown "paint"/)
  assert.throws(() => main(['scene', 'dice', '--reaction', 'cheer']), /--reaction is advance or failure/)
})

test('an option the command does not take is an error, so a typo is not drawn with defaults', () => {
  assert.throws(() => main(['band', '--stage', 'plan', '--column', '29']), /unknown option --column for band/)
  assert.throws(() => main(['scene', 'dice', '--bogus', '1']), /unknown option --bogus for scene/)
  assert.throws(() => main(['idle', 'classic', '--agents', 'fable']), /unknown option --agents for idle/)
})

test('--width, --columns, --scale and --columns-per-row below 1 are errors', () => {
  const out = join(dir, 'never.png')
  for (const [args, name] of [
    [['scene', 'dice', '--width', '0'], '--width'],
    [['band', '--stage', 'plan', '--columns', '0'], '--columns'],
    [['waiting', '--agents', 'fable', '--columns', '0'], '--columns'],
    [['scene', 'dice', '--scale', '0'], '--scale'],
    [['scene', 'dice', '--columns-per-row', '0'], '--columns-per-row'],
  ] as const) {
    assert.throws(() => main([...args, '--count', '1', '--out', out]), new RegExp(`${name} must be at least 1, not "0"`))
  }
  assert.throws(() => main(['scene', 'dice', '--scale', '-1']), /--scale must be a whole number/)
})

test('band and waiting refuse a stray positional id', () => {
  assert.throws(() => main(['band', 'plan', '--stage', 'plan']), /unexpected "plan" for band\nusage:/)
  assert.throws(() => main(['waiting', 'fable', '--agents', 'fable']), /unexpected "fable" for waiting\nusage:/)
})

test('a missing --workflow file says so in one line', () => {
  const path = join(dir, 'nope.json')
  assert.throws(() => main(['band', '--stage', 'plan', '--workflow', path]), (e: Error) => e.message === `no workflow file at ${path}`)
})

test('waiting takes --scene and --demo, and names the sheet by them', () => {
  const was = process.cwd()
  process.chdir(dir)
  try {
    assert.equal(main(['waiting', '--agents', 'fable', '--scene', 'rowing', '--count', '1']).path, 'frames-waiting-rowing-fable.png')
    assert.equal(main(['waiting', '--demo', '--scene', 'building', '--count', '1']).path, 'frames-waiting-building-demo.png')
    assert.equal(main(['waiting', '--agents', 'fable', '--count', '1']).path, 'frames-waiting-laptops-fable.png')
    assert.throws(() => main(['waiting', '--demo', '--agents', 'fable']), /waiting takes --agents or --demo, not both/)
  } finally {
    process.chdir(was)
  }
})

test('waiting takes --columns, the area\'s width', () => {
  const out = join(dir, 'narrow.png')
  const result = main(['waiting', '--agents', 'fable,opus', '--columns', '30', '--count', '2', '--columns-per-row', '2', '--out', out])
  assert.equal(result.width, (2 * (30 + 1) + 1) * 8)
})

test('a show-off sheet is named without the colon, which Windows refuses in a file name', () => {
  const was = process.cwd()
  process.chdir(dir)
  try {
    assert.equal(main(['idle', 'show-off:spec', '--count', '1']).path, 'frames-idle-show-off-spec.png')
    assert.equal(main(['idle', 'show-off:*', '--count', '1']).path, 'frames-idle-show-off--.png')
  } finally {
    process.chdir(was)
  }
})

test('band takes --scene, the scene under a working bar', () => {
  const out = join(dir, 'working.png')
  const result = main(['band', '--stage', 'develop', '--working', '--scene', 'dice', '--columns', '80', '--count', '1', '--out', out])
  assert.equal(result.height, (2 + 9 + 1 + 2) * 16)
})

test('band takes --idle, the routine under the bar', () => {
  const out = join(dir, 'done.png')
  const result = main(['band', '--stage', 'done', '--idle', 'celebrate', '--columns', '80', '--count', '1', '--out', out])
  assert.equal(result.height, (2 + 9 + 1 + 2) * 16)
})

test('turn draws the area through a turn, 500 ms apart unless told, and takes no id', () => {
  const out = join(dir, 'turn.png')
  const result = main(['turn', '--stage', 'develop', '--count', '2', '--columns-per-row', '2', '--out', out])
  assert.deepEqual(result, { path: out, width: (2 * (120 + 1) + 1) * 8, height: (9 + 1 + 2) * 16 })
  assert.throws(() => main(['turn', 'dice']), /unexpected "dice" for turn/)
  assert.throws(() => main(['turn', '--working']), /unknown option --working for turn/)
})

test('scene takes --mode, --phase, --what and --say', () => {
  const out = join(dir, 'layer.png')
  main(['scene', 'workbench', '--phase', 'git', '--what', 'git push', '--say', 'Pushed!', '--mode', 'thinking', '--count', '1', '--out', out])
  assert.deepEqual([...readFileSync(out).subarray(0, 4)], SIGNATURE)
})

test('--columns takes a list: a row of frames per width, 4 moments each unless told', () => {
  const out = join(dir, 'widths.png')
  const result = main(['scene', 'fishing', '--columns', '48,80,120', '--out', out])
  // Each tile is as wide as the widest frame; three rows, one per width.
  assert.deepEqual(result, { path: out, width: (4 * (120 + 1) + 1) * 8, height: (3 * (9 + 1 + 1) + 1) * 16 })
  const one = main(['scene', 'fishing', '--columns', '48,80', '--count', '2', '--rows', '7', '--out', out])
  assert.deepEqual(one, { path: out, width: (2 * (80 + 1) + 1) * 8, height: (2 * (7 + 1 + 1) + 1) * 16 })
})

test('--rows is 7, 8 or 9; --columns at most 512 for the area; frames over 64 columns go 2 to a row', () => {
  const out = join(dir, 'rows.png')
  assert.equal(main(['idle', 'classic', '--rows', '8', '--count', '1', '--out', out]).height, (8 + 1 + 2) * 16)
  assert.throws(() => main(['idle', 'classic', '--rows', '10', '--out', out]), /--rows must be 7, 8 or 9, not "10"/)
  assert.throws(() => main(['scene', 'dice', '--columns', '513', '--out', out]), /--columns must be at most 512, not "513"/)
  assert.throws(() => main(['scene', 'dice', '--columns', '48,x', '--out', out]), /--columns must be whole numbers/)
  assert.throws(() => main(['scene', 'dice', '--columns', '48', '--width', '48', '--out', out]), /scene takes --columns or --width/)
  assert.equal(main(['scene', 'dice', '--count', '4', '--columns', '65', '--out', out]).width, (2 * (65 + 1) + 1) * 8)
  assert.equal(main(['scene', 'dice', '--count', '4', '--columns', '64', '--out', out]).width, (4 * (64 + 1) + 1) * 8)
})

test("band takes --width, the width setting; the band's own --columns may be wider than 512", () => {
  const out = join(dir, 'band-width.png')
  assert.equal(main(['band', '--stage', 'plan', '--columns', '600', '--width', 'full', '--count', '1', '--out', out]).width, (600 + 2) * 8)
  assert.equal(main(['band', '--stage', 'plan', '--columns', '200', '--width', '80', '--count', '1', '--out', out]).width, (200 + 2) * 8)
  assert.throws(() => main(['band', '--stage', 'plan', '--width', '30', '--out', out]), /--width must be a whole number from 48 to 512, or full, not "30"/)
})

test('--calm draws calm mode: the same frame over time; the demos refuse it', () => {
  const out = join(dir, 'calm.png')
  for (const args of [['scene', 'dice'], ['idle', 'nyan'], ['waiting', '--agents', 'fable,opus'], ['band', '--stage', 'plan', '--working'], ['turn', '--stage', 'develop']]) {
    assert.deepEqual([...readFileSync(main([...args, '--calm', '--count', '1', '--out', out]).path).subarray(0, 4)], SIGNATURE)
  }
  assert.throws(() => main(['waiting', '--demo', '--calm']), /the waiting demo moves by design/)
  assert.throws(() => main(['demo-work', '--calm']), /unknown option --calm for demo-work/)
})

test('stills draws one frame per picture, captioned with its id; it needs a kind', () => {
  const out = join(dir, 'stills.png')
  // 40 pictures (39 library scenes and standing), 2 to a row (120 columns is wide): 20 rows of tiles.
  assert.deepEqual(main(['stills', 'scenes', '--out', out]), { path: out, width: (2 * (120 + 1) + 1) * 8, height: (20 * (9 + 1 + 1) + 1) * 16 })
  // 5 routines, the celebration, 10 show-offs and the doze; 4 waiting scenes; at 48 columns, 4 to a row.
  assert.equal(main(['stills', 'idle', '--columns', '48', '--out', out]).height, (5 * (9 + 1 + 1) + 1) * 16)
  assert.equal(main(['stills', 'waiting', '--columns', '48', '--rows', '7', '--out', out]).height, (1 * (7 + 1 + 1) + 1) * 16)
  // A list of widths: every picture at each.
  assert.equal(main(['stills', 'waiting', '--columns', '48,64', '--out', out]).height, (2 * (9 + 1 + 1) + 1) * 16)
  assert.throws(() => main(['stills']), /stills needs a kind: scenes, idle, waiting/)
  assert.throws(() => main(['stills', 'props']), /unknown stills kind "props"/)
  assert.throws(() => main(['stills', 'scenes', '--calm']), /unknown option --calm for stills/)
})
