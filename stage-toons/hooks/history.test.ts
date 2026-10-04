import { expect, test } from 'claude-code/testing'

import type { HistoryEntry, Progress } from '../types'
import { credit, creditAt, currentEntry, currentIndex, duration, logText, timeText } from './history'
import { cellWidth, freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W } from './workflow'

const MIN = 60_000
const H = 60 * MIN
const NL = String.fromCharCode(10)

const progress = (history: HistoryEntry[], stage = history.at(-1)?.stage ?? null): Progress => ({ ...freshProgress(0), stage, lastTrackStage: stage, history })

test('durations read <1m, minutes, hours and minutes, days and hours', () => {
  expect(duration(0)).toBe('<1m')
  expect(duration(59_999)).toBe('<1m')
  expect(duration(12 * MIN)).toBe('12m')
  expect(duration(3 * H + 5 * MIN)).toBe('3h 05m')
  expect(duration(52 * H)).toBe('2d 4h')
  expect(duration(-5)).toBe('<1m')
})

test('working time goes to the current entry, and only while its stage is the work’s', () => {
  const p = progress([
    { stage: 'spec', at: 0, by: 'claude' },
    { stage: 'plan', at: 10, by: 'claude', workMs: 100 },
  ])
  expect(currentIndex(p)).toBe(1)
  expect(credit(p, 50).history[1]!.workMs).toBe(150)
  expect(credit(p, 50).history[0]!.workMs).toBeUndefined()
  expect(credit(p, 0)).toBe(p)
  // Moved in memory by reconcile, or untracked: no current entry.
  expect(currentIndex({ ...p, stage: 'spec' })).toBe(-1)
  expect(credit({ ...p, stage: null }, 50).history).toEqual(p.history)
  expect(currentIndex(freshProgress(0))).toBe(-1)
})

test('/stage log: the last moves under their feature, with how long each lasted, Claude’s time, when and who', () => {
  const p = progress([
    { stage: 'brainstorm', at: 0, by: 'auto', feature: 'login', via: 'skill superpowers:brainstorming', workMs: 10 * MIN },
    { stage: 'spec', at: 25 * MIN, by: 'claude', feature: 'login', workMs: 30 * MIN },
    { stage: 'debugging', at: 65 * MIN, by: 'user', feature: 'signup' },
  ])
  const now = 83 * MIN
  expect(logText(W, p, now, 15, 2 * MIN).split(NL)).toEqual([
    'Stage history, last 3 moves:',
    'login',
    '  2/10 Brainstorm          25m (Claude 10m)         1h ago     by auto: skill superpowers:brainstorming',
    '  3/10 Spec                40m (Claude 30m)         58m ago    by claude',
    'signup',
    '  Debugging (side stage)   18m so far (Claude 2m)   18m ago    by user',
  ])
  expect(logText(W, p, now, 1).split(NL)).toEqual(['Stage history, last 1 move:', 'signup', '  Debugging (side stage)   18m so far (Claude <1m)   18m ago    by user'])
})

test('/stage log of older entries, and of none', () => {
  const p = progress([{ stage: 'gone', at: 0, by: 'claude' }], 'plan')
  expect(logText(W, p, 5 * MIN, 15)).toContain('(no feature)')
  expect(logText(W, p, 5 * MIN, 15)).toContain('gone (no longer in the workflow)   5m so far (Claude <1m)')
  expect(logText(W, freshProgress(0), 0, 15)).toBe('No moves yet: the history starts when the work enters a stage.')
})

test('/stage time: per feature, most recent first, and per stage in workflow order', () => {
  const p = progress([
    { stage: 'spec', at: 0, by: 'claude', feature: 'login', workMs: 20 * MIN },
    { stage: 'plan', at: 30 * MIN, by: 'claude', feature: 'login', workMs: 5 * MIN },
    { stage: 'spec', at: 60 * MIN, by: 'user', feature: null },
    { stage: 'gone', at: 70 * MIN, by: 'claude', feature: null },
    { stage: 'spec', at: 80 * MIN, by: 'claude', feature: 'login' },
  ])
  expect(timeText(W, p, 3 * H, 10 * MIN).split(NL)).toEqual([
    'Time per feature:',
    '  login                              2h 40m (Claude 35m)',
    '  (no feature)                       20m (Claude <1m)',
    'Time per stage:',
    '  3/10 Spec                          2h 20m (Claude 30m)',
    '  5/10 Plan                          30m (Claude 5m)',
    '  gone (no longer in the workflow)   10m (Claude <1m)',
    'From the last 5 moves, since 3h ago.',
  ])
  expect(timeText(W, freshProgress(0), 0)).toBe('No moves yet: the history starts when the work enters a stage.')
})

test('working time finds its entry again by stage and start, in a copy another session saved', () => {
  const mine = progress([{ stage: 'spec', at: 0, by: 'claude', workMs: 100 }])
  const theirs = progress([
    { stage: 'spec', at: 0, by: 'claude', workMs: 100 },
    { stage: 'plan', at: 50, by: 'user' },
  ])
  const after = creditAt(theirs, currentEntry(mine), 25)
  expect(after.history.map(h => h.workMs)).toEqual([125, undefined])
  expect(creditAt(theirs, { stage: 'gone', at: 0 }, 25)).toBe(theirs)
  expect(creditAt(theirs, null, 25)).toBe(theirs)
})

test('/stage log lines up wide stage labels by terminal cells', () => {
  const stage = (id: string, label: string) => ({ id, label, message: 'm', when: 'w', scenes: ['gift'] })
  const w = { track: [stage('a', '計画'), stage('b', 'Plan')], side: [] }
  const p = progress([
    { stage: 'a', at: 0, by: 'claude' },
    { stage: 'b', at: MIN, by: 'claude' },
  ])
  const rows = logText(w, p, 2 * MIN, 15).split(NL).slice(2)
  // Each row's duration starts in the same terminal column.
  expect(rows.map(r => cellWidth(r.slice(0, r.indexOf('1m'))))).toEqual([13, 13])
})
