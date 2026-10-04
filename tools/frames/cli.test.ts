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
    [['scene', 'bricklaying'], 2 * (48 + 1) + 1, 7 + 1 + 2],
    [['idle', 'classic', '--doze'], 2 * (48 + 1) + 1, 7 + 1 + 2],
    [['waiting', '--agents', 'fable,opus'], 2 * (48 + 1) + 1, 7 + 1 + 2],
    [['band', '--stage', 'plan', '--columns', '80'], 2 * (80 + 1) + 1, 2 + 7 + 1 + 2],
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
  assert.equal(result.width, 2 * (48 + 2) * 8)
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
