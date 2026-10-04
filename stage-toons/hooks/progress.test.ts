import { expect, test } from 'claude-code/testing'

import { type KV, loadProgress, saveProgress, staleKeys, storeKey, validate } from './progress'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W } from './workflow'

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
  const good = applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: 1 })
  expect(validate(good)).toEqual(good)
  expect(validate(null)).toBeNull()
  expect(validate('plan')).toBeNull()
  expect(validate({ ...good, v: 3 })).toBeNull()
  expect(validate({ ...good, stage: 3 })).toBeNull()
  expect(validate({ ...good, lastTrackStage: 5 })).toBeNull()
  expect(validate({ ...good, message: 3 })).toBeNull()
  expect(validate({ ...good, feature: 3 })).toBeNull()
  expect(validate({ ...good, history: 'none' })).toBeNull()
  expect(validate({ ...good, history: [{ stage: 'plan', at: 1, by: 'user' }, { stage: 7, at: 2, by: 'user' }, 'junk'] })?.history).toEqual([
    { stage: 'plan', at: 1, by: 'user' },
  ])
})

test('progress loads, falls back to fresh, and reports an unreadable store', async () => {
  const good = applyMove(W, freshProgress(0), { stage: 'develop', by: 'claude', at: 1 })
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
  const good = applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: 1 })
  for (const at of [NaN, Infinity, -Infinity]) {
    expect(validate({ ...good, updatedAt: at })).toBeNull()
    expect(validate({ ...good, history: [{ stage: 'plan', at, by: 'user' }] })?.history).toEqual([])
  }
})

test('progress v1 loads as v2; the old fresh state loads as untracked', () => {
  const v1 = { v: 1, stage: 'plan', lastTrackStage: 'plan', feature: null, message: 'Writing', history: [], updatedAt: 3 }
  expect(validate(v1)).toEqual({ ...v1, v: 2 })
  const oldFresh = { v: 1, stage: 'other', lastTrackStage: null, feature: null, message: 'Not tracked yet', history: [], updatedAt: 3 }
  expect(validate(oldFresh)).toEqual({ ...oldFresh, v: 2, stage: null })
  expect(validate({ ...oldFresh, v: 2, stage: null })).toEqual({ ...oldFresh, v: 2, stage: null })
  expect(validate({ ...oldFresh, v: 3 })).toBeNull()
})

test("history entries keep this version's fields, checked; older entries read as before", () => {
  const good = applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: 1 })
  const history = [
    { stage: 'plan', at: 1, by: 'user' },
    { stage: 'spec', at: 2, by: 'auto', feature: 'login', via: 'wrote docs/a.md', workMs: 500, extra: true },
    { stage: 'spec', at: 3, by: 'robot' },
    { stage: 'spec', at: 4, by: 'claude', feature: 7, via: '', workMs: -1 },
    { stage: 'spec', at: 5, by: 'claude', feature: null, workMs: Infinity },
  ]
  expect(validate({ ...good, history })?.history).toEqual([
    { stage: 'plan', at: 1, by: 'user' },
    { stage: 'spec', at: 2, by: 'auto', feature: 'login', via: 'wrote docs/a.md', workMs: 500, extra: true },
    { stage: 'spec', at: 4, by: 'claude' },
    { stage: 'spec', at: 5, by: 'claude', feature: null },
  ])
})

test("pruning picks projects untouched for 180 days, never the session's own or one it can't read", () => {
  const DAY = 86_400_000
  const now = 400 * DAY
  const at = (days: number) => applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: now - days * DAY })
  const entries = [
    ['progress:/old', at(181)],
    ['progress:/recent', at(10)],
    ['progress:/mine', at(300)],
    ['progress:/future', { v: 3, updatedAt: 0 }],
    ['hidden', true],
  ] as const
  expect(staleKeys(entries, now, 'progress:/mine')).toEqual(['progress:/old'])
})
