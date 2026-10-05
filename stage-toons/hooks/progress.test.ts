import { expect, test } from 'claude-code/testing'

import type { HistoryEntry, Progress } from '../types'
import { type KV, loadProgress, saveProgress, staleKeys, storeKey, stored, validate } from './progress'
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
  expect(validate({ ...good, v: 4 })).toBeNull()
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
  expect(entries.k).toEqual(stored(freshProgress(1)))
  expect((entries.k as { v: number }).v).toBe(3)
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
  expect(validate({ ...oldFresh, v: 4 })).toBeNull()
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
    ['progress:/future', { v: 4, updatedAt: 0 }],
    ['hidden', true],
  ] as const
  expect(staleKeys(entries, now, 'progress:/mine')).toEqual(['progress:/old'])
})

test('pruning keeps the 50 most recently moved projects, the session\'s own among them', () => {
  const DAY = 86_400_000
  const now = 400 * DAY
  const entries = Array.from({ length: 60 }, (_, i) => [`progress:/p${i}`, applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: now - i * 1000 })] as const)
  const stale = staleKeys(entries, now, 'progress:/p0')
  expect(stale).toHaveLength(10)
  expect(stale[0]).toBe('progress:/p50')
  expect(stale.includes('progress:/p0')).toBe(false)
})

// ---- v3: the record as saved ----

const entry = (stage: string, at: number, by: HistoryEntry['by'], rest: Partial<HistoryEntry> = {}): HistoryEntry => ({ stage, at, by, ...rest })
const progressOf = (history: HistoryEntry[], feature: string | null = null): Progress => ({
  v: 2,
  stage: 'plan',
  lastTrackStage: 'plan',
  feature,
  message: 'Planning',
  history,
  updatedAt: 99,
})

test('a saved record is v3: entries as arrays, the feature only where it changes, empty tails left out', () => {
  const p = progressOf(
    [
      entry('spec', 1, 'user', { feature: 'login' }),
      entry('plan', 2, 'claude', { feature: 'login', workMs: 500 }),
      entry('develop', 3, 'auto', { feature: 'login', via: 'wrote docs/a.md' }),
      entry('cleanup', 4, 'claude', { feature: null }),
      entry('other', 5, 'user'),
      entry('spec', 6, 'claude', { feature: 'logout', workMs: 7, cost: { usd: 1.5, in: 100, out: 20 } }),
    ],
    'logout',
  )
  expect(stored(p)).toEqual({
    v: 3,
    stage: 'plan',
    lastTrackStage: 'plan',
    feature: 'logout',
    message: 'Planning',
    history: [
      ['spec', 1, 'u', 0, 0, 0, 'login'],
      ['plan', 2, 'c', 500],
      ['develop', 3, 'a', 0, 0, 'wrote docs/a.md'],
      ['cleanup', 4, 'c', 0, 0, 0, null],
      ['other', 5, 'u'],
      ['spec', 6, 'c', 7, [1.5, 100, 20], 0, 'logout'],
    ],
    updatedAt: 99,
  })
})

test('a v3 record reads back: the feature carried forward, 0 as absent, an entry with none as null', () => {
  const raw = {
    v: 3,
    stage: 'plan',
    lastTrackStage: 'plan',
    feature: 'login',
    message: 'Planning',
    history: [['spec', 1, 'u', 0, 0, 0, 'login'], ['plan', 2, 'c', 500], ['develop', 3, 'a', 0, 0, 'wrote it'], ['cleanup', 4, 'c', 0, 0, 0, null], ['other', 5, 'u']],
    updatedAt: 99,
  }
  expect(validate(raw)?.history).toEqual([
    entry('spec', 1, 'user', { feature: 'login' }),
    entry('plan', 2, 'claude', { feature: 'login', workMs: 500 }),
    entry('develop', 3, 'auto', { feature: 'login', via: 'wrote it' }),
    entry('cleanup', 4, 'claude', { feature: null }),
    entry('other', 5, 'user', { feature: null }),
  ])
  expect(validate(raw)?.v).toBe(2)
})

test('v3 reads each field checked: a bad entry is dropped but its feature change still carries', () => {
  const good = progressOf([])
  const read = (history: unknown[]) => validate({ ...stored(good), history })?.history
  expect(read([['spec', 1, 'u', 0, 0, 0, 'a'], ['plan', NaN, 'u', 0, 0, 0, 'b'], ['plan', 3, 'u']])).toEqual([
    entry('spec', 1, 'user', { feature: 'a' }),
    entry('plan', 3, 'user', { feature: 'b' }),
  ])
  expect(read(['junk', null, 7, {}, ['spec'], [7, 1, 'u'], ['spec', 1, 'x'], ['spec', 1, 'claude'], ['spec', 1, '__proto__'], ['spec', 1, 'u']])).toEqual([entry('spec', 1, 'user', { feature: null })])
  expect(read([['spec', 1, 'u', -5, 0, 0, 3], ['spec', 2, 'u', Infinity], ['spec', 3, 'u', 'x', 0, '']])).toEqual([
    entry('spec', 1, 'user', { feature: null }),
    entry('spec', 2, 'user', { feature: null }),
    entry('spec', 3, 'user', { feature: null }),
  ])
  expect(validate({ ...stored(good), history: 'none' })).toBeNull()
  expect(validate({ ...stored(good), stage: 3 })).toBeNull()
  expect(validate({ ...stored(good), updatedAt: NaN })).toBeNull()
  // The cut and the cap are the same as v2's.
  const long = 'x'.repeat(80)
  expect(read([['spec', 1, 'u', 0, 0, long]])?.[0]?.via?.length).toBeLessThanOrEqual(60)
  expect(read([['spec', 1, 'u', 0, 0, 0, long]])?.[0]?.feature?.length).toBeLessThanOrEqual(40)
  const many = Array.from({ length: 250 }, (_, i) => ['spec', i, 'u'])
  expect(read(many)?.map(h => h.at)).toEqual(Array.from({ length: 200 }, (_, i) => i + 50))
})

test('a cost is checked on read: finite, non-negative numbers, else dropped without the entry', () => {
  const good = progressOf([])
  const cost = { usd: 0.25, in: 10, out: 2 }
  // v2 keeps one when present.
  const v2 = (c: unknown) => validate({ ...good, history: [{ stage: 'plan', at: 1, by: 'user', cost: c }] })?.history
  expect(v2(cost)).toEqual([{ stage: 'plan', at: 1, by: 'user', cost }])
  expect(v2({ ...cost, extra: 1 })).toEqual([{ stage: 'plan', at: 1, by: 'user', cost }])
  for (const bad of [null, 5, 'x', [], { usd: 1, in: 1 }, { usd: -1, in: 1, out: 1 }, { usd: 1, in: NaN, out: 1 }, { usd: 1, in: 1, out: Infinity }, { usd: '1', in: 1, out: 1 }]) {
    expect(v2(bad)).toEqual([{ stage: 'plan', at: 1, by: 'user' }])
  }
  const v3 = (c: unknown) => validate({ ...stored(good), history: [['plan', 1, 'u', 0, c]] })?.history
  expect(v3([0.25, 10, 2])).toEqual([entry('plan', 1, 'user', { feature: null, cost })])
  for (const bad of [0, null, 'x', [1, 2], [-1, 1, 1], [1, NaN, 1], [1, 1, Infinity], ['1', 1, 1], { usd: 1, in: 1, out: 1 }]) {
    expect(v3(bad)).toEqual([entry('plan', 1, 'user', { feature: null })])
  }
  expect(v3([0, 0, 0])).toEqual([entry('plan', 1, 'user', { feature: null, cost: { usd: 0, in: 0, out: 0 } })])
})

// A small seeded generator, so a failing case can be run again.
function random(seed: number): () => number {
  let a = seed

  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('v2 to v3 and back gives the same progress, normalised, for random histories', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rand = random(seed)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
    const history: HistoryEntry[] = []
    let at = 1000
    let feature: string | null | undefined
    for (let i = 0, n = Math.floor(rand() * 30); i < n; i++) {
      at += pick([0, 0, 5, 1000, -300])
      if (rand() < 0.4) feature = pick([undefined, null, 'login', 'logout', 'a b', 'x'.repeat(40)])
      const e: HistoryEntry = { stage: pick(['spec', 'plan', 'develop', 'other']), at, by: pick(['claude', 'user', 'auto'] as const) }
      if (feature !== undefined) e.feature = feature
      if (rand() < 0.35) e.via = pick(['wrote docs/a.md', 'ran npm test', 'y'.repeat(60)])
      if (rand() < 0.5) e.workMs = pick([0, 1, 500, 90_000])
      if (rand() < 0.3) e.cost = pick([{ usd: 0, in: 0, out: 0 }, { usd: 1.25, in: 1000, out: 50 }])
      history.push(e)
    }
    const p = progressOf(history, feature ?? null)
    const normal = { ...p, history: history.map(({ workMs, ...h }) => ({ ...h, feature: h.feature ?? null, ...(workMs ? { workMs } : {}) })) }
    expect(validate(stored(p))).toEqual(normal)
    // Through JSON, as the store keeps it.
    expect(validate(JSON.parse(JSON.stringify(stored(p))))).toEqual(normal)
  }
})

test('pruning reads v3 records, and a v3 save is read by a load', async () => {
  const DAY = 86_400_000
  const now = 400 * DAY
  const at = (days: number) => stored(applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: now - days * DAY }))
  expect(staleKeys([['progress:/old', at(181)], ['progress:/recent', at(10)]], now, 'progress:/mine')).toEqual(['progress:/old'])
  const entries: Record<string, unknown> = {}
  const p = applyMove(W, applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: 1, feature: 'login' }), { stage: 'develop', by: 'claude', at: 2 })
  await saveProgress(memory(entries), 'k', p)
  expect(await loadProgress(memory(entries), 'k', 9)).toEqual({ progress: p, isAvailable: true })
})
