// The idle Clawd beside the bar while Claude waits for you: 26 columns by
// 4 rows (26 x 8 pixels). Awake, he plays one routine, picked each time a
// turn starts for the idle period after it; after a minute every routine
// turns into the same doze.

import type { IdleId } from '../../types'
import { pickOne } from '../pick'
import { createBuffer, type PixelBuffer } from '../pixels'
import { classic } from './classic'
import { DOZE_MS, drawDoze } from './doze'
import { nyan } from './nyan'
import type { IdleRoutine } from './routine'

export { CLAWD_X, DOZE_MS, Z_COLOR } from './doze'
export type { IdleRoutine } from './routine'

export const IDLE_COLS = 26
export const IDLE_ROWS = 4
export const FALLBACK_ROUTINE = 'classic'
export const ROUTINES: Record<IdleId, IdleRoutine> = { classic, nyan }
export const IDLE_IDS: readonly IdleId[] = Object.keys(ROUTINES)

export const pickIdle = (previous: IdleId | undefined, random: number): IdleId => pickOne(IDLE_IDS, previous, random)

const drawn = (r: IdleRoutine, idleMs: number): PixelBuffer => {
  const b = createBuffer(IDLE_COLS, IDLE_ROWS * 2)
  r.draw(b, (idleMs / 1000) % r.loop)

  return b
}

// The box idleMs into an idle period. A routine that throws is replaced by
// classic from then on (broken), and reported once (onBreak).
export function idleFrame(routine: IdleId, idleMs: number, broken: Set<IdleId> = new Set(), onBreak?: (id: IdleId, error: unknown) => void): PixelBuffer {
  if (idleMs >= DOZE_MS) {
    const b = createBuffer(IDLE_COLS, IDLE_ROWS * 2)
    drawDoze(b, (idleMs - DOZE_MS) / 1000)

    return b
  }
  const id = broken.has(routine) || ROUTINES[routine] === undefined ? FALLBACK_ROUTINE : routine
  try {
    return drawn(ROUTINES[id]!, idleMs)
  } catch (error) {
    broken.add(id)
    onBreak?.(id, error)

    return drawn(ROUTINES[FALLBACK_ROUTINE]!, idleMs)
  }
}
