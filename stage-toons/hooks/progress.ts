// Saving a project's progress with $.store, under a key per project
// directory, and reading it back only when it still has the shape this
// version writes.

import type { HistoryEntry, Progress, TrackStageId } from '../types'
import { cut, FEATURE_MAX, freshProgress, isStageId, isTrack, MESSAGE_MAX } from './stages'

export type KV = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

// One key per directory: separators as /, no trailing /, and a Windows path
// lowercased, since its spellings name the same directory.
export function storeKey(cwd: string): string {
  let dir = cwd.replace(/\\/g, '/')
  while (dir.length > 1 && dir.endsWith('/') && !/^[A-Za-z]:\/$/.test(dir)) dir = dir.slice(0, -1)
  if (/^[A-Za-z]:/.test(dir)) dir = dir.toLowerCase()

  return `progress:${dir}`
}

const isEntry = (h: unknown): h is HistoryEntry => {
  if (typeof h !== 'object' || h === null) return false
  const e = h as Record<string, unknown>

  return isStageId(e.stage) && typeof e.at === 'number' && (e.by === 'claude' || e.by === 'user')
}

export function validate(x: unknown): Progress | null {
  if (typeof x !== 'object' || x === null) return null
  const p = x as Record<string, unknown>
  if (p.v !== 1 || !isStageId(p.stage)) return null
  const last = p.lastTrackStage
  if (last !== null && !(isStageId(last) && isTrack(last))) return null
  if (typeof p.message !== 'string' || typeof p.updatedAt !== 'number') return null
  if (p.feature !== null && typeof p.feature !== 'string') return null
  if (!Array.isArray(p.history)) return null

  return {
    v: 1,
    stage: p.stage,
    lastTrackStage: last as TrackStageId | null,
    feature: p.feature === null ? null : cut(p.feature as string, FEATURE_MAX),
    message: cut(p.message, MESSAGE_MAX),
    history: p.history.filter(isEntry),
    updatedAt: p.updatedAt,
  }
}

export async function loadProgress(store: KV, key: string, now: number): Promise<{ progress: Progress; isAvailable: boolean }> {
  try {
    return { progress: validate(await store.get(key)) ?? freshProgress(now), isAvailable: true }
  } catch {
    return { progress: freshProgress(now), isAvailable: false }
  }
}

export async function saveProgress(store: KV, key: string, p: Progress): Promise<boolean> {
  try {
    await store.set(key, p)

    return true
  } catch {
    return false
  }
}
