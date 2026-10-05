// The idle Clawd at the bottom left of the area below the bar while Claude
// waits for you: 26 columns by 4 rows (26 x 8 pixels). Awake, he plays one routine, picked each time a
// turn starts for the idle period after it; after a minute every routine
// turns into the same doze.

import type { IdleId } from '../../types'
import { pickOne } from '../pick'
import { createBuffer, type PixelBuffer } from '../pixels'
import { classic } from './classic'
import { coffee } from './coffee'
import { DEEP_SLEEP_MS, DOZE_MS, drawDoze, STILL_T } from './doze'
import { nyan } from './nyan'
import { reading } from './reading'
import type { IdleRoutine } from './routine'
import { yoYo } from './yo-yo'

export { CLAWD_X, DEEP_SLEEP_MS, DOZE_MS, Z_COLOR } from './doze'
export type { IdleRoutine } from './routine'

export const IDLE_COLS = 26
export const IDLE_ROWS = 4
// The routines as written: `satisfies` checks the table but keeps its own
// type, so its exact keys make RoutineName.
const LIBRARY = { classic, nyan, coffee, reading, 'yo-yo': yoYo } satisfies Record<IdleId, IdleRoutine>

// A routine's name in the library, checked by tsc. Names read from state
// stay IdleId (any string).
export type RoutineName = keyof typeof LIBRARY

export const FALLBACK_ROUTINE: RoutineName = 'classic'
// The library, indexed by any string (a saved name may be unknown).
export const ROUTINES: Record<IdleId, IdleRoutine> = LIBRARY
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
    drawDoze(b, idleMs >= DOZE_MS + DEEP_SLEEP_MS ? STILL_T : (idleMs - DOZE_MS) / 1000)

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
