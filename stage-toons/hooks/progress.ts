// Saving a project's progress with $.store, under a key per project
// directory, and reading it back only when it still has the shape this
// version writes. The shape is checked here; stage ids against the
// workflow elsewhere.

import type { HistoryEntry, Progress, StageId } from '../types'
import { cut, FEATURE_MAX, freshProgress, MESSAGE_MAX, NOT_TRACKED } from './stages'

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

  return typeof e.stage === 'string' && Number.isFinite(e.at) && (e.by === 'claude' || e.by === 'user')
}

export function validate(x: unknown): Progress | null {
  if (typeof x !== 'object' || x === null) return null
  const p = x as Record<string, unknown>
  if (p.v !== 1 && p.v !== 2) return null
  if (p.stage !== null && typeof p.stage !== 'string') return null
  if (p.v === 1 && p.stage === null) return null
  const last = p.lastTrackStage
  if (last !== null && typeof last !== 'string') return null
  if (typeof p.message !== 'string' || typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) return null
  if (p.feature !== null && typeof p.feature !== 'string') return null
  if (!Array.isArray(p.history)) return null
  // v0.2 filed a fresh project under Other.
  const wasFresh = p.v === 1 && p.stage === 'other' && last === null && p.message === NOT_TRACKED && p.history.length === 0

  return {
    v: 2,
    stage: wasFresh ? null : (p.stage as StageId | null),
    lastTrackStage: last as StageId | null,
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
