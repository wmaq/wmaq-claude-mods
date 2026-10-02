// The progress bar above the prompt, as lines of styled spans: the stepped
// track, where the work stands and the feature, the Fable tag while an
// auditor runs, and the message. Sized to the band so nothing wraps.

import type { Progress } from '../types'
import { isTrack, position, rank, TRACK } from './stages'

export type Tone = 'done' | 'current' | 'future' | 'label' | 'tag' | 'message'
export type Span = { text: string; tone: Tone }

// Below this many columns the band is one line.
export const WIDE_MIN = 50
export const TAG = '⌕ Fable reviewing'

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

export function bandLayout(p: Progress, isAuditing: boolean, columns: number): Span[][] {
  // One column spare, so a line never touches the edge.
  const width = Math.max(1, columns - 1)
  if (columns < WIDE_MIN) return [[{ text: fit(`${position(p)} — ${p.message}`, width), tone: 'label' }]]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(p)]
  const room = width - lengthOf(track)
  const withFeature = `  ${position(p)}${p.feature ? ` · ${p.feature}` : ''}`
  const tag = isAuditing ? `  ${TAG}` : ''
  // The tag goes first, then the feature; what still overflows is cut.
  const label = withFeature.length <= room ? withFeature : `  ${position(p)}`
  const line1: Span[] = [...track, { text: fit(label, room), tone: 'label' }]
  if (tag && label.length + tag.length <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fit(` ${p.message}`, width), tone: 'message' }]]
}
