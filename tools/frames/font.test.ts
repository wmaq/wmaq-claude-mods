import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { cellsOf } from '../../stage-toons/hooks/stages'
import { DEFAULT_WORKFLOW } from '../../stage-toons/hooks/workflow'
import { glyph, GLYPH_H } from './font'

test('the font has every ASCII character, 16 rows each', () => {
  for (let cp = 0x20; cp < 0x7f; cp++) {
    const rows = glyph(cp)
    assert.ok(rows, `no glyph for ${String.fromCharCode(cp)}`)
    assert.equal(rows.length, GLYPH_H)
  }
})

test('the font has every character the bar can print', () => {
  // Read from the bar's own sources, so a character added there fails here.
  const hooks = join(__dirname, '..', '..', 'stage-toons', 'hooks')
  const missing = new Set<string>()
  for (const file of ['band.ts', 'stages.ts', 'demo.ts']) {
    for (const ch of readFileSync(join(hooks, file), 'utf8')) {
      const cp = ch.codePointAt(0)!
      if (cp > 0x7e && cellsOf(ch) === 1 && glyph(cp) === null) missing.add(`${ch} U+${cp.toString(16).toUpperCase()}`)
    }
  }
  assert.deepEqual([...missing], [])
})

test('the two characters unscii lacks are drawn', () => {
  for (const cp of [0x2315, 0x21a9]) assert.ok(glyph(cp)?.some(row => row !== 0))
})

test('a character the font lacks has no glyph', () => {
  assert.equal(glyph(0x4e2d), null)
})

test('the font has every character of the default workflow\'s labels and messages', () => {
  const missing = new Set<string>()
  for (const stage of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) {
    for (const ch of `${stage.label}${stage.message}`) {
      const cp = ch.codePointAt(0)!
      if (cellsOf(ch) === 1 && glyph(cp) === null) missing.add(`${ch} U+${cp.toString(16).toUpperCase()}`)
    }
  }
  assert.deepEqual([...missing], [])
})
