// What the idle Clawd does while awake: drawn on the 26 x 8 pixel box at t
// seconds into its loop. A background, when it has one, is drawn on the
// whole 48 x 14 area behind the box, given the idle period's time in
// seconds, unwrapped, so it can drift with no jump at the loop point.

import type { IdleId } from '../../types'
import type { PixelBuffer } from '../pixels'

export type IdleRoutine = { id: IdleId; loop: number; draw: (b: PixelBuffer, t: number) => void; background?: (b: PixelBuffer, time: number) => void }
