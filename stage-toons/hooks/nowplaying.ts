// What Spotify plays, as every platform's reader gives it (Clawd DJ), and
// what the mod makes of it: the track, the two-misses rule, the poll's
// pace. Pure: readers.ts has the commands, register.tsx runs them.

export type NowPlaying = { artist: string; title: string; isPlaying: boolean }

// What a script printed (Windows', macOS'): the track, or null for {} (no
// Spotify session), output that isn't the scripts' JSON, or no title.
export function parseNowPlaying(stdout: string): NowPlaying | null {
  let raw: unknown
  try {
    raw = JSON.parse(stdout.trim())
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { status, artist, title } = raw as Record<string, unknown>
  if (typeof title !== 'string' || title.trim() === '') return null

  return { artist: typeof artist === 'string' ? artist.trim() : '', title: title.trim(), isPlaying: status === 'Playing' }
}

// The track as the now-playing box writes it, and as /stage dj answers it.
export const trackText = (np: NowPlaying): string => (np.artist ? `${np.artist} - ${np.title}` : np.title)
export const trackLine = (np: NowPlaying): string => `♪ ${np.artist ? `${np.artist} – ${np.title}` : np.title}`

// Why a read gave nothing: the command didn't start or ran past its time
// (rejected), it exited with an error (exit), it printed something that
// isn't its answer (output), or macOS's Automation permission is denied
// (denied).
export type ReadFailure = 'rejected' | 'exit' | 'output' | 'denied'
// A finished read: the track, or nothing playing, and what failed if
// anything did.
export type Outcome = { track: NowPlaying | null; failure: ReadFailure | null }

// What the mod has heard of the music: the last track read (kept through a
// pause, and through a read that found none, for the answer), whether the
// DJ picture shows, and how many reads in a row said not playing. The
// picture goes only after two: a skip or a short pause keeps the booth.
export type Music = { track: NowPlaying | null; isPlaying: boolean; misses: number }
export const NO_MUSIC: Music = { track: null, isPlaying: false, misses: 0 }
export const MISSES_TO_STOP = 2

export function heard(h: Music, read: NowPlaying | null): Music {
  if (read?.isPlaying) return { track: read, isPlaying: true, misses: 0 }
  const misses = h.misses + 1

  return { track: read ?? h.track, isPlaying: h.isPlaying && misses < MISSES_TO_STOP, misses }
}

// Whether a read brought another track than the one playing: the scene
// swaps the record then.
export const isNewTrack = (before: Music, after: Music): boolean =>
  before.isPlaying && after.isPlaying && before.track !== null && after.track !== null && trackText(before.track) !== trackText(after.track)

// The poll's pace: a read every 5 s while the area shows, every 30 s while
// it doesn't (the band hidden, collapsed or yielding) and while Clawd
// sleeps with nothing playing. A read may take this long before it counts
// as failed (reads never overlap: the loop awaits each).
export const POLL_MS = 5000
export const SLOW_POLL_MS = 30_000
export const READ_TIMEOUT_MS = 10_000
// /stage dj on reads in its own hook, whose budget (10 s) the read must not
// spend: it may take this long, and the poll catches up after it.
export const COMMAND_READ_MS = 4000

export type PollState = { isAreaShown: boolean; isAsleep: boolean; isPlaying: boolean }

export const nextDelay = (s: PollState): number => (s.isAreaShown && (s.isPlaying || !s.isAsleep) ? POLL_MS : SLOW_POLL_MS)
