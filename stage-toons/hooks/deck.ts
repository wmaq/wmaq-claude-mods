// A stage's deck of scenes: each scene plays once, in a shuffled order,
// before any plays again, and never the same scene twice in a row, a refill
// included. Pure: random is the source of numbers in [0, 1), passed in so a
// test can seed it.

export type Card = { scene: string; deck: string[] }

// The items in a random order (Fisher-Yates; the input is left alone).
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }

  return out
}

// The next scene for a stage and the deck that is left. scenes: what the
// stage lists now. deck: the scenes still to play, in order (undefined for
// a state an older version left: as empty). last: the scene the stage
// showed last. Cards the stage no longer lists leave the deck; an empty
// deck is refilled with the stage's scenes shuffled, the scene shown last
// moved from the top to the bottom when there are two or more.
export function dealCard(scenes: readonly string[], deck: readonly string[] | undefined, last: string | undefined, random: () => number): Card {
  let cards = (deck ?? []).filter(scene => scenes.includes(scene))
  if (cards.length === 0) {
    cards = shuffled(scenes, random)
    if (cards.length >= 2 && cards[0] === last) cards.push(cards.shift()!)
  }

  return { scene: cards[0]!, deck: cards.slice(1) }
}
