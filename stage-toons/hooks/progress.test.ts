import { expect, test } from 'claude-code/testing'

import { type KV, loadProgress, saveProgress, storeKey, validate } from './progress'
import { applyMove, freshProgress } from './stages'

const BS = String.fromCharCode(92)

const memory = (entries: Record<string, unknown> = {}, isBroken = false): KV => ({
  get: async key => {
    if (isBroken) throw new Error('store unavailable')

    return entries[key]
  },
  set: async (key, value) => {
    if (isBroken) throw new Error('store unavailable')
    entries[key] = value
  },
})

test('Windows spellings of one directory share a key; POSIX paths keep their case', () => {
  const key = storeKey(`C:${BS}Dev${BS}Proj${BS}`)
  expect(key).toBe('progress:c:/dev/proj')
  expect(storeKey('c:/dev/proj')).toBe(key)
  expect(storeKey(`c:${BS}DEV${BS}proj`)).toBe(key)
  expect(storeKey('/home/u/Proj/')).toBe('progress:/home/u/Proj')
  expect(storeKey(`C:${BS}`)).toBe('progress:c:/')
})

test('stored progress is validated', () => {
  const good = applyMove(freshProgress(0), { stage: 'plan', by: 'user', at: 1 })
  expect(validate(good)).toEqual(good)
  expect(validate(null)).toBeNull()
  expect(validate('plan')).toBeNull()
  expect(validate({ ...good, v: 2 })).toBeNull()
  expect(validate({ ...good, stage: 'deploy' })).toBeNull()
  expect(validate({ ...good, lastTrackStage: 'other' })).toBeNull()
  expect(validate({ ...good, message: 3 })).toBeNull()
  expect(validate({ ...good, feature: 3 })).toBeNull()
  expect(validate({ ...good, history: 'none' })).toBeNull()
  expect(validate({ ...good, history: [{ stage: 'plan', at: 1, by: 'user' }, { stage: 'nope', at: 2, by: 'user' }, 'junk'] })?.history).toEqual([
    { stage: 'plan', at: 1, by: 'user' },
  ])
})

test('progress loads, falls back to fresh, and reports an unreadable store', async () => {
  const good = applyMove(freshProgress(0), { stage: 'develop', by: 'claude', at: 1 })
  expect(await loadProgress(memory({ k: good }), 'k', 9)).toEqual({ progress: good, isAvailable: true })
  expect(await loadProgress(memory({ k: { v: 9 } }), 'k', 9)).toEqual({ progress: freshProgress(9), isAvailable: true })
  expect(await loadProgress(memory({}, true), 'k', 9)).toEqual({ progress: freshProgress(9), isAvailable: false })
})

test('saving reports failure instead of throwing', async () => {
  const entries: Record<string, unknown> = {}
  expect(await saveProgress(memory(entries), 'k', freshProgress(1))).toBe(true)
  expect(entries.k).toEqual(freshProgress(1))
  expect(await saveProgress(memory({}, true), 'k', freshProgress(1))).toBe(false)
})

test('a timestamp that is not a finite number is refused', () => {
  const good = applyMove(freshProgress(0), { stage: 'plan', by: 'user', at: 1 })
  for (const at of [NaN, Infinity, -Infinity]) {
    expect(validate({ ...good, updatedAt: at })).toBeNull()
    expect(validate({ ...good, history: [{ stage: 'plan', at, by: 'user' }] })?.history).toEqual([])
  }
})
