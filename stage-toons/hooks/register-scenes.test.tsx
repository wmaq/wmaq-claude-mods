import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { ScenePick } from '../types'
import { engine, KEY, NOW, runStage, setStage, START } from './harness'

const FILE = '.claude/stage-toons.json'
const stage = (id: string, scenes: string[]) => ({ id, label: id.toUpperCase(), message: `In ${id}`, when: id, scenes })
const TWO = { track: [stage('alpha', ['bricklaying', 'sweeping']), stage('beta', ['gift', 'writing-desk'])], side: [] }
const json = (data: unknown) => JSON.stringify(data, null, 2)

// Every pick the mod writes to $.state, in order.
function picksOf(on: On): ScenePick[] {
  const picks: ScenePick[] = []
  on('state.set', ($, e, next) => {
    const write = e as unknown as { key: string; value: unknown }
    if (write.key === 'scene') picks.push(write.value as ScenePick)

    return next(e)
  })

  return picks
}

test("a stage change picks one of the stage's scenes; the same stage keeps it", async ($, on) => {
  const picks = picksOf(on)
  const { world } = engine(on)
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  expect(picks).toHaveLength(0)
  await setStage($, { stage: 'alpha', message: 'Starting' })
  expect(picks).toHaveLength(1)
  expect(picks[0]!.stage).toBe('alpha')
  expect(['bricklaying', 'sweeping']).toContain(picks[0]!.scene)
  expect(picks[0]!.lastByStage).toEqual({ alpha: picks[0]!.scene })
  await setStage($, { stage: 'alpha', message: 'Still at it', feature: 'gauge' })
  await runStage($, 'message Polishing')
  expect(picks).toHaveLength(1)
})

test('entering a two-scene stage again shows the other scene', async ($, on) => {
  const picks = picksOf(on)
  const { world } = engine(on)
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  await setStage($, { stage: 'alpha', message: 'One' })
  await setStage($, { stage: 'beta', message: 'Two' })
  await setStage($, { stage: 'alpha', message: 'Three' })
  expect(picks.map(p => p.stage)).toEqual(['alpha', 'beta', 'alpha'])
  expect(picks[2]!.scene).not.toBe(picks[0]!.scene)
  expect(picks[2]!.lastByStage.alpha).toBe(picks[2]!.scene)
})

test('a hot reload keeps the pick', async ($, on) => {
  const picks = picksOf(on)
  on('state.get', ($, e, next) =>
    e.key === 'scene' ? { value: { value: { stage: 'alpha', scene: 'sweeping', lastByStage: { alpha: 'sweeping' } }, version: 1 } } : next(e),
  )
  const progress = { v: 2, stage: 'alpha', lastTrackStage: 'alpha', feature: null, message: 'In alpha', history: [], updatedAt: NOW - 1 }
  const { world } = engine(on, { store: { [KEY]: progress } })
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  expect(picks).toHaveLength(0)
})

test('a workflow reload picks again only when the stage no longer lists its scene', async ($, on) => {
  const picks = picksOf(on)
  const { world } = engine(on)
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  await setStage($, { stage: 'alpha', message: 'One' })
  world.files[FILE] = json({ ...TWO, track: [stage('alpha', [picks[0]!.scene, 'test-tubes']), TWO.track[1]] })
  await runStage($, 'workflow reload')
  expect(picks).toHaveLength(1)
  world.files[FILE] = json({ ...TWO, track: [stage('alpha', ['test-tubes']), TWO.track[1]] })
  await runStage($, 'workflow reload')
  expect(picks.at(-1)).toMatchObject({ stage: 'alpha', scene: 'test-tubes' })
})

test("progress another session saved is adopted at the next prompt, with a pick for its stage", async ($, on) => {
  const picks = picksOf(on)
  const { world } = engine(on)
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  await setStage($, { stage: 'alpha', message: 'One' })
  const theirs = { v: 2, stage: 'beta', lastTrackStage: 'beta', feature: null, message: 'In beta', history: [], updatedAt: NOW + 60_000 }
  world.store[KEY] = theirs
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(picks.at(-1)?.stage).toBe('beta')
  expect(['gift', 'writing-desk']).toContain(picks.at(-1)?.scene)
})

test('going untracked and back to the same stage deals the next scene', async ($, on) => {
  const picks = picksOf(on)
  const { world } = engine(on)
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  await setStage($, { stage: 'alpha', message: 'One' })
  const away = { v: 2, stage: null, lastTrackStage: 'alpha', feature: null, message: 'Not tracked yet', history: [], updatedAt: NOW + 60_000 }
  world.store[KEY] = away
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  // Untracked clears the held pick's stage and keeps the deck.
  expect(picks.at(-1)).toMatchObject({ stage: null, scene: picks[0]!.scene })
  expect(picks.at(-1)!.decks?.alpha).toHaveLength(1)
  world.store[KEY] = { ...away, stage: 'alpha', message: 'In alpha', updatedAt: NOW + 120_000 }
  await $.prompt.submit({ text: 'again', wait: false, origin: { kind: 'composer' } } as never)
  expect(picks.at(-1)!.stage).toBe('alpha')
  expect(picks.at(-1)!.scene).not.toBe(picks[0]!.scene)
  expect(picks.at(-1)!.decks?.alpha).toEqual([])
})

test('a state with no decks, as an older version left it, deals from a fresh deck', async ($, on) => {
  const picks = picksOf(on)
  // The old state is what the first reads find, until the mod writes its own.
  on('state.get', ($, e, next) =>
    e.key === 'scene' && picks.length === 0 ? { value: { value: { stage: 'alpha', scene: 'sweeping', lastByStage: { alpha: 'sweeping' } }, version: 1 } } : next(e),
  )
  const progress = { v: 2, stage: 'alpha', lastTrackStage: 'alpha', feature: null, message: 'In alpha', history: [], updatedAt: NOW - 1 }
  const { world } = engine(on, { store: { [KEY]: progress } })
  world.files[FILE] = json(TWO)
  await $.session.start(START)
  await setStage($, { stage: 'beta', message: 'Two' })
  await setStage($, { stage: 'alpha', message: 'Back' })
  expect(picks.at(-1)).toMatchObject({ stage: 'alpha', scene: 'bricklaying' })
  expect(picks.at(-1)!.decks?.alpha).toEqual(['sweeping'])
})
