import { expect, test } from 'claude-code/testing'

import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'

test('a Fable spawn is the auditor unless it only inherited Fable', () => {
  expect(isAuditorSpawn({ model: 'fable', parentModel: 'claude-opus-5-5' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ parentModel: 'claude-opus-5-5' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ parentModel: 'claude-fable-5-1' }, 'claude-fable-5-1')).toBe(false)
  expect(isAuditorSpawn({ model: 'fable', parentModel: 'claude-fable-5-1' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ model: 'sonnet', parentModel: 'claude-opus-5-5' }, 'claude-sonnet-5-5')).toBe(false)
})

test('tracked auditors that are no longer running are stale', () => {
  expect(staleAuditors(['a', 'b', 'c'], [{ id: 'a', status: 'running' }, { id: 'b', status: 'killed' }])).toEqual(['b', 'c'])
})

test('failures play at most once every three seconds', () => {
  expect(isFailureDue(null, 0)).toBe(true)
  expect(isFailureDue(1000, 3999)).toBe(false)
  expect(isFailureDue(1000, 4000)).toBe(true)
})
