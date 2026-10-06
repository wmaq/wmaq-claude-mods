// What the idle Clawd does while awake: drawn on the 26 x 8 pixel box at t
// seconds into its loop. A background, when it has one, is drawn on the
// whole area behind the box (in the core's coordinates: rightOf and topOf
// give the area's edges), given the idle period's time in seconds,
// unwrapped, so it can drift with no jump at the loop point. still, in
// seconds into the loop, is the moment calm mode holds (stillOf in
// scene.ts says the same for scenes): his eyes open, the routine's idea in
// view.

import type { IdleId } from '../../types'
import type { PixelBuffer } from '../pixels'

export type IdleRoutine = { id: IdleId; loop: number; still?: number; draw: (b: PixelBuffer, t: number) => void; background?: (b: PixelBuffer, time: number) => void }
