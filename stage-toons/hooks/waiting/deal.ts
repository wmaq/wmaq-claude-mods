// Which waiting scene plays: dealt from a deck as a stage's scenes are
// (deck.ts), each once before any again and never the same twice in a row,
// with random numbers seeded by the waiting period's start, so a frame
// follows from the mod's state and the time alone.

import { dealCard } from '../deck'

export const WAITING_SCENE_IDS = ['laptops', 'building', 'rowing', 'conveyor'] as const
export type WaitingSceneId = (typeof WAITING_SCENE_IDS)[number]
export const isWaitingScene = (id: string): id is WaitingSceneId => (WAITING_SCENE_IDS as readonly string[]).includes(id)
// The scene a waiting period falls back on when its own throws.
export const FALLBACK_WAITING: WaitingSceneId = 'laptops'

// The scenes still to play, in order, and the one shown last.
export type WaitingDeal = { deck: readonly WaitingSceneId[]; last: WaitingSceneId | undefined }
export const NEW_DEAL: WaitingDeal = { deck: [], last: undefined }

// Numbers in [0, 1) from a seed (mulberry32).
export function seeded(seed: number): () => number {
  let a = Math.floor(seed) >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), a | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)

    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// The next scene and the deal after it; the scenes that threw this session
// are left out (the laptops stay, the fallback).
export function dealWaiting(deal: WaitingDeal, broken: ReadonlySet<WaitingSceneId>, seed: number): { scene: WaitingSceneId; deal: WaitingDeal } {
  const scenes = WAITING_SCENE_IDS.filter(id => id === FALLBACK_WAITING || !broken.has(id))
  const card = dealCard(scenes, deal.deck, deal.last, seeded(seed))
  const scene = card.scene as WaitingSceneId

  return { scene, deal: { deck: card.deck as WaitingSceneId[], last: scene } }
}
