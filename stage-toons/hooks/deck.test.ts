import { expect, test } from 'claude-code/testing'

import { dealCard } from './deck'

// A small seeded random source: the same seed gives the same sequence.
function seeded(seed: number): () => number {
  let state = seed

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296

    return state / 4294967296
  }
}

// Deals n cards the way the mod does: the deck and the last card carry over.
function play(scenes: string[], n: number, random: () => number, start: { deck?: string[]; last?: string } = {}): string[] {
  const dealt: string[] = []
  let deck = start.deck
  let last = start.last
  for (let i = 0; i < n; i++) {
    const card = dealCard(scenes, deck, last, random)
    dealt.push(card.scene)
    deck = card.deck
    last = card.scene
  }

  return dealt
}

test('every scene of a stage plays once before any repeats', () => {
  const scenes = ['a', 'b', 'c', 'd']
  for (let seed = 1; seed <= 20; seed++) {
    const dealt = play(scenes, 12, seeded(seed))
    for (let round = 0; round < 3; round++) expect([...dealt.slice(round * 4, round * 4 + 4)].sort()).toEqual(scenes)
  }
})

test('no scene plays twice in a row, across refills too', () => {
  for (const scenes of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']]) {
    for (let seed = 1; seed <= 50; seed++) {
      const dealt = play(scenes, 40, seeded(seed))
      for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1])
    }
  }
})

test('a refill never starts with the scene shown last', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const card = dealCard(['a', 'b', 'c'], [], 'b', seeded(seed))
    expect(card.scene).not.toBe('b')
    expect([card.scene, ...card.deck].sort()).toEqual(['a', 'b', 'c'])
  }
})

test('a stage that lists one scene plays it each time', () => {
  expect(play(['gift'], 4, seeded(3))).toEqual(['gift', 'gift', 'gift', 'gift'])
  expect(dealCard(['gift'], undefined, 'gift', seeded(3))).toEqual({ scene: 'gift', deck: [] })
})

test('a deal takes the next card off the deck and leaves the rest', () => {
  expect(dealCard(['a', 'b', 'c'], ['c', 'a'], 'b', seeded(1))).toEqual({ scene: 'c', deck: ['a'] })
})

test('scenes dropped from a stage leave its deck', () => {
  expect(dealCard(['a', 'c'], ['b', 'c', 'x', 'a'], undefined, seeded(1))).toEqual({ scene: 'c', deck: ['a'] })
  // A deck of nothing but dropped scenes is empty: a refill of what is listed.
  const again = dealCard(['d', 'e'], ['b', 'x'], undefined, seeded(1))
  expect([again.scene, ...again.deck].sort()).toEqual(['d', 'e'])
})

test('no deck, as an older version left it, reads as an empty one', () => {
  const card = dealCard(['a', 'b'], undefined, undefined, seeded(2))
  expect([card.scene, ...card.deck].sort()).toEqual(['a', 'b'])
})

test('the random source decides the order', () => {
  const a = dealCard(['a', 'b', 'c'], [], undefined, () => 0)
  const b = dealCard(['a', 'b', 'c'], [], undefined, () => 0.99)
  expect([a.scene, ...a.deck]).not.toEqual([b.scene, ...b.deck])
})
