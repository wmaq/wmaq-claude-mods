import { expect, test } from 'claude-code/testing'

import { dealWaiting, isWaitingScene, NEW_DEAL, seeded, WAITING_SCENE_IDS, type WaitingDeal, type WaitingSceneId } from './deal'

const NONE = new Set<WaitingSceneId>()

test('seeded numbers: in [0, 1), the same for the same seed, different for another', () => {
  const a = seeded(1234)
  const b = seeded(1234)
  const xs = Array.from({ length: 50 }, () => a())
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true)
  expect(Array.from({ length: 50 }, () => b())).toEqual(xs)
  expect(seeded(1235)()).not.toBe(xs[0])
})

test('the deal: each scene once before any again, never the same twice in a row', () => {
  let deal: WaitingDeal = NEW_DEAL
  const shown: WaitingSceneId[] = []
  for (let i = 0; i < 40; i++) {
    const next = dealWaiting(deal, NONE, 1000 + i * 7919)
    shown.push(next.scene)
    deal = next.deal
  }
  for (let round = 0; round < 10; round++) expect([...shown.slice(round * 4, round * 4 + 4)].sort()).toEqual([...WAITING_SCENE_IDS].sort())
  for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1])
})

test('the same seed and deck deal the same scene; the deck holding one scene deals it', () => {
  expect(dealWaiting(NEW_DEAL, NONE, 42)).toEqual(dealWaiting(NEW_DEAL, NONE, 42))
  expect(dealWaiting({ deck: ['rowing'], last: undefined }, NONE, 42).scene).toBe('rowing')
})

test('scenes that threw are left out; the laptops always stay', () => {
  const broken = new Set<WaitingSceneId>(['building', 'rowing', 'conveyor', 'laptops'])
  let deal: WaitingDeal = NEW_DEAL
  for (let i = 0; i < 5; i++) {
    const next = dealWaiting(deal, broken, i)
    expect(next.scene).toBe('laptops')
    deal = next.deal
  }
  expect(isWaitingScene('rowing')).toBe(true)
  expect(isWaitingScene('sailing')).toBe(false)
})
