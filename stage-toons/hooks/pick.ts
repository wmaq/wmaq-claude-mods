// Picking one of several at random, never the one shown last when there is
// another: a stage's scene, the idle Clawd's routine. random is in [0, 1).

export function pickOne<T>(items: readonly T[], previous: T | undefined, random: number): T {
  const others = items.filter(item => item !== previous)
  const candidates = others.length > 0 && others.length < items.length ? others : items

  return candidates[Math.min(candidates.length - 1, Math.floor(random * candidates.length))]!
}
