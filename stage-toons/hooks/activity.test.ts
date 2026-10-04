import { expect, test } from 'claude-code/testing'

import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'

test('a Fable spawn is the auditor unless it only inherited Fable', () => {
  expect(isAuditorSpawn({ model: 'fable', parentModel: 'claude-opus-5-5' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ parentModel: 'claude-opus-5-5' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ parentModel: 'claude-fable-5-1' }, 'claude-fable-5-1')).toBe(false)
  expect(isAuditorSpawn({ model: 'fable', parentModel: 'claude-fable-5-1' }, 'claude-fable-5-1')).toBe(true)
  expect(isAuditorSpawn({ model: 'sonnet', parentModel: 'claude-opus-5-5' }, 'claude-sonnet-5-5')).toBe(false)
})

test('tracked auditors that ended or left the list are stale', () => {
  expect(staleAuditors(['a', 'b', 'c'], [{ id: 'a', status: 'running' }, { id: 'b', status: 'killed' }])).toEqual(['b', 'c'])
  expect(staleAuditors(['d', 'e'], [{ id: 'd', status: 'completed' }, { id: 'e', status: 'failed' }])).toEqual(['d', 'e'])
})

test('an auditor not yet started, held, or between turns is still at work', () => {
  // Since 2.1.289 the list says pending, waiting and idle, not only running.
  const agents = [{ id: 'p', status: 'pending' }, { id: 'w', status: 'waiting' }, { id: 'i', status: 'idle' }]
  expect(staleAuditors(['p', 'w', 'i'], agents)).toEqual([])
})

test('failures play at most once every three seconds', () => {
  expect(isFailureDue(null, 0)).toBe(true)
  expect(isFailureDue(1000, 3999)).toBe(false)
  expect(isFailureDue(1000, 4000)).toBe(true)
})
