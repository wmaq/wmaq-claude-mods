// The waiting scenes, by id.

export const WAITING_SCENE_IDS = ['laptops', 'building'] as const
export type WaitingSceneId = (typeof WAITING_SCENE_IDS)[number]
export const isWaitingScene = (id: string): id is WaitingSceneId => (WAITING_SCENE_IDS as readonly string[]).includes(id)
// The scene a waiting period falls back on when its own throws.
export const FALLBACK_WAITING: WaitingSceneId = 'laptops'
