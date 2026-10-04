// Saving a project's progress with $.store, under a key per project
// directory, and reading it back only when it still has the shape this
// version writes. The shape is checked here; stage ids against the
// workflow elsewhere.

import type { HistoryEntry, Progress, StageId } from '../types'
import { VIA_MAX } from './auto'
import { cut, FEATURE_MAX, freshProgress, HISTORY_MAX, MESSAGE_MAX, NOT_TRACKED } from './stages'

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

// A history entry as saved, or null: the fields this version knows, each
// checked; feature, via and workMs are optional (older versions wrote none).
// Fields it doesn't know (a newer version's) are kept as they are.
function entryOf(h: unknown): HistoryEntry | null {
  if (typeof h !== 'object' || h === null) return null
  const e = h as Record<string, unknown>
  if (typeof e.stage !== 'string' || !Number.isFinite(e.at) || (e.by !== 'claude' && e.by !== 'user' && e.by !== 'auto')) return null
  const { feature: _feature, via: _via, workMs: _workMs, ...rest } = e
  const entry: HistoryEntry = { ...rest, stage: e.stage, at: e.at as number, by: e.by }
  if (e.feature === null || typeof e.feature === 'string') entry.feature = e.feature === null ? null : cut(e.feature, FEATURE_MAX) || null
  if (typeof e.via === 'string' && e.via.trim() !== '') entry.via = cut(e.via, VIA_MAX)
  if (typeof e.workMs === 'number' && Number.isFinite(e.workMs) && e.workMs >= 0) entry.workMs = e.workMs

  return entry
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
    history: p.history
      .map(entryOf)
      .filter((h): h is HistoryEntry => h !== null)
      .slice(-HISTORY_MAX),
    updatedAt: p.updatedAt,
  }
}

// Saved progress is pruned at most this often, and a project's goes once
// nobody has moved it for this long.
export const PRUNE_EVERY_MS = 7 * 86_400_000
export const PRUNE_AFTER_MS = 180 * 86_400_000

// The progress keys to delete: projects untouched for PRUNE_AFTER_MS, never
// the session's own, never one this version can't read (a newer version's).
export function staleKeys(entries: readonly (readonly [string, unknown])[], now: number, keep: string): string[] {
  return entries
    .filter(([key, value]) => {
      if (!key.startsWith('progress:') || key === keep) return false
      const p = validate(value)

      return p !== null && now - p.updatedAt > PRUNE_AFTER_MS
    })
    .map(([key]) => key)
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
