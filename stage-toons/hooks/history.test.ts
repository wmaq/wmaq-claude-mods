import { expect, test } from 'claude-code/testing'

import type { HistoryEntry, Progress } from '../types'
import { costText, creditAt, currentEntry, currentIndex, duration, logText, timeText, tokenCount } from './history'
import { cellWidth, freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W } from './workflow'

// Claude's working time added to the current entry.
const credit = (p: Progress, ms: number): Progress => creditAt(p, currentEntry(p), ms)

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

test('a credit with no time still goes in when its tokens or dollars are above zero, and adds to the cost there', () => {
  const p = progress([{ stage: 'spec', at: 0, by: 'claude', workMs: 100 }])
  const key = currentEntry(p)
  expect(creditAt(p, key, 0, { usd: 0, in: 10, out: 2 }).history[0]).toEqual({ stage: 'spec', at: 0, by: 'claude', workMs: 100, cost: { usd: 0, in: 10, out: 2 } })
  expect(creditAt(p, key, 0, { usd: 0.25, in: 0, out: 0 }).history[0]!.cost).toEqual({ usd: 0.25, in: 0, out: 0 })
  const both = creditAt(creditAt(p, key, 50, { usd: 1, in: 10, out: 2 }), key, 25, { usd: 0.5, in: 5, out: 1 })
  expect(both.history[0]).toEqual({ stage: 'spec', at: 0, by: 'claude', workMs: 175, cost: { usd: 1.5, in: 15, out: 3 } })
  // Nothing above zero: the progress as it was, as before.
  expect(creditAt(p, key, 0, { usd: 0, in: 0, out: 0 })).toBe(p)
  expect(creditAt(p, key, 0)).toBe(p)
  // Time alone adds no cost.
  expect(creditAt(p, key, 50).history[0]!.cost).toBeUndefined()
  expect(creditAt(p, null, 0, { usd: 1, in: 1, out: 1 })).toBe(p)
})

test('a cost reads as dollars to the cent and tokens in k and M', () => {
  expect(costText({ usd: 3.2, in: 1_200_000, out: 48_000 })).toBe('$3.20 · 1.2M in, 48k out')
  expect(costText({ usd: 0, in: 850, out: 1234 })).toBe('850 in, 1.2k out')
  expect(costText({ usd: 0.004, in: 0, out: 0 })).toBe('<$0.01')
  expect(costText({ usd: 0.126, in: 9950, out: 999_500 })).toBe('$0.13 · 10k in, 1M out')
  expect(costText({ usd: 0, in: 0, out: 0 })).toBe('')
  expect(tokenCount(999_499)).toBe('999k')
  expect(tokenCount(25_000_000)).toBe('25M')
})

const COST_NOTE = 'Costs count from when stage-toons loaded in each session, so /cost can show more.'

test('/stage log adds each entry’s cost beside Claude’s time, lined up, and the entries without one as before', () => {
  const p = progress([
    { stage: 'spec', at: 0, by: 'claude', feature: 'login', workMs: 30 * MIN, cost: { usd: 3.2, in: 1_200_000, out: 48_000 } },
    { stage: 'plan', at: 40 * MIN, by: 'user', feature: 'login' },
  ])
  expect(logText(W, p, 60 * MIN, 15).split(NL)).toEqual([
    'Stage history, last 2 moves:',
    'login',
    '  3/10 Spec   40m (Claude 30m · $3.20 · 1.2M in, 48k out)   1h ago     by claude',
    `  5/10 Plan   20m so far (Claude <1m)${' '.repeat(20)}   20m ago    by user`,
    COST_NOTE,
  ])
})

test('/stage time adds the summed cost to the lines whose entries have one', () => {
  const p = progress([
    { stage: 'spec', at: 0, by: 'claude', feature: 'login', workMs: 20 * MIN, cost: { usd: 1, in: 1000, out: 100 } },
    { stage: 'plan', at: 30 * MIN, by: 'claude', feature: 'login', workMs: 5 * MIN, cost: { usd: 0.25, in: 0, out: 0 } },
    { stage: 'spec', at: 60 * MIN, by: 'user', feature: null, cost: { usd: 0, in: 500, out: 50 } },
    { stage: 'gone', at: 70 * MIN, by: 'claude', feature: null },
  ])
  expect(timeText(W, p, 80 * MIN).split(NL)).toEqual([
    'Time per feature:',
    '  (no feature)                       20m (Claude <1m · 500 in, 50 out)',
    '  login                              1h 00m (Claude 25m · $1.25 · 1k in, 100 out)',
    'Time per stage:',
    '  3/10 Spec                          40m (Claude 20m · $1.00 · 1.5k in, 150 out)',
    '  5/10 Plan                          30m (Claude 5m · $0.25)',
    '  gone (no longer in the workflow)   10m (Claude <1m)',
    'From the last 4 moves, since 1h ago.',
    COST_NOTE,
  ])
})

test('Done lasts no time: /stage log and /stage time say done there, with Claude’s time, and the feature’s time stops at the merge', () => {
  const p = progress([
    { stage: 'cleanup', at: 0, by: 'claude', feature: 'login', workMs: 10 * MIN },
    { stage: 'done', at: 30 * MIN, by: 'auto', feature: 'login', via: 'bash rule gh pr merge', workMs: 2 * MIN },
  ])
  expect(logText(W, p, 3 * H, 15).split(NL)).toEqual([
    'Stage history, last 2 moves:',
    'login',
    '  10/10 Cleanup   30m (Claude 10m)   3h ago     by claude',
    '  ✓ Done          done (Claude 2m)   2h ago     by auto: bash rule gh pr merge',
  ])
  expect(timeText(W, p, 3 * H).split(NL)).toEqual([
    'Time per feature:',
    '  login           30m (Claude 12m)',
    'Time per stage:',
    '  10/10 Cleanup   30m (Claude 10m)',
    '  ✓ Done          done (Claude 2m)',
    'From the last 2 moves, since 3h ago.',
  ])
})
