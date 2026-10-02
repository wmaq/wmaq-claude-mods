// The progress bar above the prompt, as lines of styled spans: the stepped
// track, where the work stands and the feature, the Fable tag while an
// auditor runs, and the message. Sized to the band so nothing wraps.

import type { Progress } from '../types'
import { IDLE_COLS } from './idle'
import { isTrack, position, rank, TRACK } from './stages'

export type Tone = 'done' | 'current' | 'future' | 'label' | 'tag' | 'message'
export type Span = { text: string; tone: Tone }

// Below this many columns the band is one line.
export const WIDE_MIN = 50
export const TAG = '⌕ Fable reviewing'
// The fewest columns a toon is drawn in, cropped.
export const TOON_MIN = 30
// Columns between the idle Clawd and the bar.
export const IDLE_GAP = 2
// The idle Clawd shows only where the two-line bar still fits beside it.
export const IDLE_MIN = IDLE_COLS + IDLE_GAP + WIDE_MIN

export type BandMode = 'none' | 'text' | 'idle' | 'demo'
export type BandSite = {
  surface: string
  isWorking: boolean
  hasSurvey: boolean
  isAgentView: boolean
  isHidden: boolean
  columns: number
  isDemo: boolean
}

// What the band draws: nothing of stage-toons' (yielding), the text bar,
// the bar beside the idle Clawd while Claude waits, or the bar over the
// demo. The cartoons are terminal only.
export function bandMode(s: BandSite): BandMode {
  if (s.hasSurvey || s.isAgentView || s.isHidden) return 'none'
  if (s.surface !== 'terminal') return 'text'
  if (s.isDemo) return s.columns >= TOON_MIN ? 'demo' : 'text'

  return !s.isWorking && s.columns >= IDLE_MIN ? 'idle' : 'text'
}

// The track as it stands: done steps and the links between them, the
// current step, and the steps to come. In Other, the track as it stood at
// the last track stage, all dim.
export function trackSpans(p: Progress): Span[] {
  const isOff = !isTrack(p.stage)
  const at = isTrack(p.stage) ? rank(p.stage) : rank(p.lastTrackStage)
  const lit = (tone: Tone): Tone => (isOff ? 'future' : tone)
  const spans: Span[] = []
  TRACK.forEach((_, i) => {
    if (i > 0) spans.push(i <= at ? { text: '━', tone: lit('done') } : { text: '─', tone: 'future' })
    spans.push(i < at ? { text: '●', tone: lit('done') } : i === at ? { text: '◉', tone: lit('current') } : { text: '○', tone: 'future' })
  })

  return spans
}

const fit = (text: string, width: number): string => (text.length <= width ? text : width < 1 ? '' : `${text.slice(0, width - 1)}…`)
const lengthOf = (spans: Span[]) => spans.reduce((n, s) => n + s.text.length, 0)

// message, when given, stands in for the progress's own (the demo's line).
export function bandLayout(p: Progress, isAuditing: boolean, columns: number, message = p.message): Span[][] {
  // One column spare, so a line never touches the edge.
  const width = Math.max(1, columns - 1)
  if (columns < WIDE_MIN) return [[{ text: fit(`${position(p)} — ${message}`, width), tone: 'label' }]]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(p)]
  const room = width - lengthOf(track)
  const withFeature = `  ${position(p)}${p.feature ? ` · ${p.feature}` : ''}`
  const tag = isAuditing ? `  ${TAG}` : ''
  // The tag goes first, then the feature; what still overflows is cut.
  const label = withFeature.length <= room ? withFeature : `  ${position(p)}`
  const line1: Span[] = [...track, { text: fit(label, room), tone: 'label' }]
  if (tag && label.length + tag.length <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fit(` ${message}`, width), tone: 'message' }]]
}
