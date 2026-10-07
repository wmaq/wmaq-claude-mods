import { expect, test } from 'claude-code/testing'

import { fnv1a, goldenHashes } from './golden'
import { GOLDEN } from './golden-table'

test('fnv1a: the 32-bit FNV-1a of a string, as 8 hex digits', () => {
  expect(fnv1a('')).toBe('811c9dc5')
  expect(fnv1a('a')).toBe('e40c292c')
})

test("every picture on a 48-column, 7-row area draws exactly its recorded frames: 0.11.0's, or phase 6b's or 6c's for the scenes they reworked or added", () => {
  const now = goldenHashes()
  expect(Object.keys(now).sort()).toEqual(Object.keys(GOLDEN).sort())
  const changed = Object.keys(GOLDEN).filter(name => now[name] !== GOLDEN[name])
  expect(changed).toEqual([])
})
