// What the idle Clawd does while awake: drawn on the 26 x 8 pixel box at t
// seconds into its loop.

import type { IdleId } from '../../types'
import type { PixelBuffer } from '../pixels'

export type IdleRoutine = { id: IdleId; loop: number; draw: (b: PixelBuffer, t: number) => void }
