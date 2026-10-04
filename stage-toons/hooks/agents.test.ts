import { expect, test } from 'claude-code/testing'

import { atWork, EMPTY_ROSTER, ended, KINDS_KEPT, LIST_LAG_MS, modelKind, reconcileRoster, rememberKind, type Roster, spawned } from './agents'

const ids = (r: Roster) => atWork(r).map(a => a.id)
// Long after any spawn or turn's end, so the list's lag does not apply.
const LATER = 1_000_000

test('a model is known by its family, Fable first, ignoring case; anything else is unknown', () => {
  expect(modelKind('claude-sonnet-5-5')).toBe('sonnet')
  expect(modelKind('claude-opus-5-5[1m]')).toBe('opus')
  expect(modelKind('claude-fable-5-1')).toBe('fable')
  expect(modelKind('claude-haiku-4-5-20251001')).toBe('haiku')
  expect(modelKind('Sonnet')).toBe('sonnet')
  expect(modelKind('haiku')).toBe('haiku')
  expect(modelKind('fable-opus-hybrid')).toBe('fable')
  expect(modelKind('opus-sonnet')).toBe('opus')
  expect(modelKind('gpt-9')).toBe('unknown')
  expect(modelKind(undefined)).toBe('unknown')
})

test('a spawn puts the agent to work with its kind; a spawn naming no known model keeps the kind it had', () => {
  let r = spawned(EMPTY_ROSTER, 'a', 'claude-sonnet-5-5', 5)
  expect(r.get('a')).toEqual({ id: 'a', kind: 'sonnet', isAtWork: true, spawnedAt: 5, endedAt: null })
  r = ended(r, 'a', 10)
  r = spawned(r, 'a', undefined, 20)
  expect(r.get('a')).toEqual({ id: 'a', kind: 'sonnet', isAtWork: true, spawnedAt: 20, endedAt: null })
})

test("an agent's turn ending stops its work at once", () => {
  const r = ended(spawned(EMPTY_ROSTER, 'a', 'opus', 0), 'a', 100)
  expect(r.get('a')).toMatchObject({ kind: 'opus', isAtWork: false, endedAt: 100 })
  expect(ended(r, 'nobody', 100)).toBe(r)
})

test('the list sets who is at work: pending, running and waiting are; idle is kept, not at work; ended and unlisted agents go', () => {
  let r: Roster = EMPTY_ROSTER
  for (const id of ['p', 'r', 'w', 'i', 'c', 'f', 'k', 'gone']) r = spawned(r, id, 'sonnet', 0)
  r = reconcileRoster(r, [
    { id: 'p', status: 'pending' },
    { id: 'r', status: 'running' },
    { id: 'w', status: 'waiting' },
    { id: 'i', status: 'idle' },
    { id: 'c', status: 'completed' },
    { id: 'f', status: 'failed' },
    { id: 'k', status: 'killed' },
  ], LATER)
  expect(ids(r)).toEqual(['p', 'r', 'w'])
  expect([...r.keys()]).toEqual(['p', 'r', 'w', 'i'])
  expect(r.get('i')).toMatchObject({ kind: 'sonnet', isAtWork: false })
})

test('an agent at work that the roster lacks joins as unknown; an idle teammate that works again keeps its kind', () => {
  let r = spawned(EMPTY_ROSTER, 'mate', 'claude-haiku-4-5', 0)
  r = reconcileRoster(r, [{ id: 'mate', status: 'idle' }, { id: 'old', status: 'running' }, { id: 'done', status: 'completed' }], LATER)
  expect(ids(r)).toEqual(['old'])
  expect(r.get('old')).toEqual({ id: 'old', kind: 'unknown', isAtWork: true, spawnedAt: null, endedAt: null })
  r = reconcileRoster(r, [{ id: 'mate', status: 'running' }, { id: 'old', status: 'running' }], LATER + 1)
  expect(ids(r)).toEqual(['mate', 'old'])
  expect(r.get('mate')?.kind).toBe('haiku')
})

test('an idle teammate the roster lacks (from before a reload) joins, not at work', () => {
  const r = reconcileRoster(EMPTY_ROSTER, [{ id: 'mate', status: 'idle' }], LATER)
  expect(r.get('mate')).toEqual({ id: 'mate', kind: 'unknown', isAtWork: false, spawnedAt: null, endedAt: null })
  expect(atWork(r)).toEqual([])
})

test('a list that still says running just after the turn ended is taken as lagging, until the lag runs out', () => {
  let r = ended(spawned(EMPTY_ROSTER, 'a', 'opus', 0), 'a', LATER)
  r = reconcileRoster(r, [{ id: 'a', status: 'running' }], LATER + LIST_LAG_MS - 1)
  expect(ids(r)).toEqual([])
  r = reconcileRoster(r, [{ id: 'a', status: 'running' }], LATER + LIST_LAG_MS)
  expect(ids(r)).toEqual(['a'])
  expect(r.get('a')?.endedAt).toBeNull()
})

test('a fresh spawn the list does not show yet keeps its place and colour; after the lag it goes', () => {
  let r = spawned(EMPTY_ROSTER, 'a', 'claude-sonnet-5-5', LATER)
  r = reconcileRoster(r, [], LATER + LIST_LAG_MS - 1)
  expect(r.get('a')).toMatchObject({ kind: 'sonnet', isAtWork: true })
  r = reconcileRoster(r, [{ id: 'a', status: 'running' }], LATER + LIST_LAG_MS)
  expect(r.get('a')).toMatchObject({ kind: 'sonnet', isAtWork: true })
  expect(reconcileRoster(spawned(EMPTY_ROSTER, 'b', 'opus', LATER), [], LATER + LIST_LAG_MS).size).toBe(0)
})

test('an agent the roster lacks (from before a reload) joins with the kind remembered for it; unknown without one', () => {
  const roster = reconcileRoster(EMPTY_ROSTER, [{ id: 'a', status: 'running' }, { id: 'b', status: 'idle' }, { id: 'c', status: 'running' }], LATER, { a: 'fable', b: 'haiku' })
  expect(roster.get('a')?.kind).toBe('fable')
  expect(roster.get('b')?.kind).toBe('haiku')
  expect(roster.get('c')?.kind).toBe('unknown')
})

test('a kind is remembered by agent id, unknown ones not at all, the newest few kept', () => {
  expect(rememberKind({}, 'a', 'unknown')).toEqual({})
  expect(rememberKind({ a: 'opus' }, 'b', 'fable')).toEqual({ a: 'opus', b: 'fable' })
  let kinds = {}
  for (let i = 0; i <= KINDS_KEPT; i++) kinds = rememberKind(kinds, `agent-${i}`, 'sonnet')
  expect(Object.keys(kinds).length).toBe(KINDS_KEPT)
  expect(Object.keys(kinds)[0]).toBe('agent-1')
})
