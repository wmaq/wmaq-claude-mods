// Clawd DJ: while Spotify plays (/stage dj on), Clawd stands behind a DJ
// booth in headphones, bobbing to the beat, one claw on the decks and the
// other pumping the air. Records spin on two turntables, the speakers
// thump on every beat, notes float up from the decks, a mirror ball hangs
// from the top and specks of light drift across the room. The helpers of
// the agents at work dance on the floor right of the speakers. From 72
// columns an equaliser and a tiled floor run on to a second speaker at the
// right edge, and a box over the floor names the track. Loop: 8 s, sixteen
// beats at 120 BPM: groove, eyes closed in the music, a scratch, a cheer.
// Gentle by default: the lights hold steady while Clawd, the records, the
// notes and the dancers move; /stage dj party lights the speakers, the
// floor, the booth's LEDs, the ball and the box with the beat.
//
// Not a library scene: no stage deals it. frames.ts draws it with djFrame,
// built for each frame from what the mod knows (the track, when it
// changed, the dancers).

import { CLAWD_W } from '../clawd'
import { clearCell, drawText, fillRect, type PixelBuffer, type Point, setPixel, textCells } from '../pixels'
import { type AreaSize, areaOf, areaShape, CLAWD_TOP, crop, cropStart, drawSprite, renderFull, type Scene, type Sprite, STAGE_W } from '../scene'
import { drawStanding } from '../waiting/draw'
import { drawWalker, WALKING_TOP } from '../waiting/index'
import { isPresent } from '../waiting/calm'
import { helperAt, homeX, MAX_SEATS, type SeatLog, type Spots } from '../waiting/seats'
import { blinking, C, every } from './kit'
import { fade, mix, wrap } from './layers'

export const DJ_LOOP = 8
export const BEAT = 0.5
// The moment calm mode holds: Clawd on the beat's dip, a claw up, a note
// on its way, eyes open.
export const DJ_STILL = 1.1
const CLAWD_X = 8
const FOCUS_X = 18

// The beat: which beat of the loop, and how far into it (0 to 1).
const beatOf = (t: number) => every(t, BEAT)
const inBeat = (t: number) => (t % BEAT) / BEAT
// Clawd dips a pixel on each beat's first moment.
const bobOf = (t: number) => (inBeat(t) < 0.3 ? 1 : 0)

// The moments of the loop.
const VIBE = 4 // eyes closed, both claws on the decks
const SCRATCH = 6 // the right record rocks back and forth
const CHEER = 7 // both claws up

// The booth: its front a row along the bottom from BOOTH_X, BOOTH_W wide;
// the two turntables and the mixer stand on it, a row above. Low, so
// Clawd's face and most of his body show over it.
const BOOTH_X = 1
const BOOTH_W = 30
const BOOTH_TOP = 13
const DECK_L = 2
const DECK_R = 22

const BOOTH = 0x2b2b33
const RECORD = 0x151515
const RIM = 0x4a4a52
const GROOVE = 0x8a8a94
const ARM = C.paperShade

// Where the groove's light is on the record as it turns: six places,
// clockwise, on the record's two rows (dx, row 0 the upper).
const GROOVE_AT: readonly (readonly [number, number])[] = [
  [2, 0],
  [4, 0],
  [5, 1],
  [4, 1],
  [2, 1],
  [1, 1],
]

// A turntable at column x: the record seen from the front and a little
// above (two rows: rim, record, the red label at its centre) on a grey
// plinth, the groove's light going round with spin, and the tone arm
// resting on it, or lifted (a track change), with the record off.
type DeckState = 'playing' | 'lifted' | 'empty'
function drawDeck(b: PixelBuffer, x: number, spin: number, state: DeckState) {
  const y = BOOTH_TOP - 2
  setPixel(b, x, y + 1, C.gray)
  setPixel(b, x + 6, y + 1, C.gray)
  if (state === 'empty') fillRect(b, x + 1, y + 1, 5, 1, C.darkGray)
  else {
    fillRect(b, x + 2, y, 3, 1, RECORD)
    setPixel(b, x + 1, y, RIM)
    setPixel(b, x + 5, y, RIM)
    fillRect(b, x + 1, y + 1, 5, 1, RECORD)
    setPixel(b, x + 3, y, C.red)
    setPixel(b, x + 3, y + 1, C.red)
    const [dx, row] = GROOVE_AT[wrap(Math.floor(spin), GROOVE_AT.length)]!
    setPixel(b, x + dx, y + row, GROOVE)
  }
  // The arm's pivot right of the record, its head on the rim or up.
  setPixel(b, x + 6, y - 1, ARM)
  if (state === 'playing') setPixel(b, x + 5, y, ARM)
  else setPixel(b, x + 6, y - 2, ARM)
}

// How the right deck stands this moment: a track change lifts the arm for
// a beat, the record off for its first half.
function rightDeck(sinceChange: number | null): DeckState {
  if (sinceChange === null || sinceChange < 0 || sinceChange >= BEAT) return 'playing'

  return sinceChange < BEAT / 2 ? 'empty' : 'lifted'
}

function drawBooth(b: PixelBuffer, t: number, sinceChange: number | null, isParty: boolean) {
  // The front, with a row of LEDs: dim and steady, or at a party running
  // with the beat.
  fillRect(b, BOOTH_X, BOOTH_TOP, BOOTH_W, 1, BOOTH)
  const beat = beatOf(t)
  const LED = [C.green, C.gold, C.red, C.blue]
  for (let k = 0; k < 7; k++) {
    const isOn = isParty && ((beat + k) % 4 === 0 || (inBeat(t) < 0.3 && k === beat % 7))
    setPixel(b, BOOTH_X + 4 + k * 4, BOOTH_TOP, isOn ? LED[k % 4]! : fade(LED[k % 4]!, 0.7))
  }
  // The left record spins steady (two turns a second); the right too, but
  // rocks back and forth during the scratch.
  const steady = t * 12
  const isScratch = t >= SCRATCH && t < CHEER
  const rock = isScratch ? steady - 6 * Math.abs(Math.sin((t - SCRATCH) * Math.PI * 4)) : steady
  drawDeck(b, DECK_L, steady, 'playing')
  drawDeck(b, DECK_R, rock, rightDeck(sinceChange))
  // The mixer between them, under Clawd: a dark plate with two faders and
  // the cross-fader, its knobs blinking with the beat at a party.
  const y = BOOTH_TOP - 1
  fillRect(b, 11, y, 9, 1, C.darkGray)
  const k = !isParty || beat % 2 === 0
  setPixel(b, 12, y, k ? C.green : C.gold)
  setPixel(b, 18, y, k ? C.gold : C.green)
  setPixel(b, 14 + (isScratch ? every(t, 0.25) % 3 : 1), y, C.white)
}

// Headphones over Clawd's head: a band over the top and a cup on each
// side, bobbing with him.
function drawPhones(b: PixelBuffer, t: number) {
  const y = CLAWD_TOP + bobOf(t)
  const x = CLAWD_X
  fillRect(b, x + 3, y - 1, 8, 1, C.gray)
  setPixel(b, x + 2, y, C.gray)
  setPixel(b, x + 11, y, C.gray)
  fillRect(b, x + 1, y + 1, 1, 2, C.blue)
  fillRect(b, x + 12, y + 1, 1, 2, C.blue)
}

// A speaker stack at column x: two cabinets, the woofer's cone; at a
// party it lights on each beat, with marks in the air beside it on the
// thump (the near stack's only where the dance floor leaves room).
const SPEAKER_X = 33
const CABINET = 0x2b2b33
function drawSpeaker(b: PixelBuffer, t: number, x: number, hasMarks: boolean, isParty: boolean) {
  fillRect(b, x, 3, 7, 4, CABINET)
  fillRect(b, x, 7, 7, 7, CABINET)
  setPixel(b, x + 3, 4, C.gray)
  setPixel(b, x + 3, 5, C.darkGray)
  const isThump = isParty && inBeat(t) < 0.3
  const ring = isThump ? C.paperShade : C.darkGray
  fillRect(b, x + 2, 8, 3, 1, ring)
  fillRect(b, x + 1, 9, 1, 3, ring)
  fillRect(b, x + 5, 9, 1, 3, ring)
  fillRect(b, x + 2, 12, 3, 1, ring)
  fillRect(b, x + 2, 9, 3, 3, isThump ? C.gray : 0x1f1f25)
  setPixel(b, x + 3, 10, isThump ? C.white : C.darkGray)
  if (isThump && hasMarks) {
    setPixel(b, x + 8, 9, C.darkGray)
    setPixel(b, x + 8, 11, C.darkGray)
  }
}

// The mirror ball, hung from the area's top right of the near speaker.
const BALL_X = 41
const BALL: Sprite = { palette: { s: C.gray, w: C.paperShade }, frames: [['.w.', 'sws', '.s.']] }
function drawBall(b: PixelBuffer, t: number, isParty: boolean) {
  const { top } = areaOf(b)
  for (let y = top; y < 1; y++) setPixel(b, BALL_X + 1, y, C.darkGray)
  drawSprite(b, BALL, 0, BALL_X, 1)
  const glint = every(t, isParty ? 0.25 : 1) % 4
  setPixel(b, BALL_X + (glint % 3), 1 + (glint === 3 ? 1 : 0), C.white)
}

// Specks of light the ball throws, placed by hand on the core's 48
// columns (repeated every 48 on a wider area) from the headroom down, and
// drifting slowly right, round the area. None is drawn on the ball or its
// cord; at a party, one in four is bright for a moment in turn.
const SPECKS: readonly (readonly [number, number, number])[] = [
  [3, 1, C.blue],
  [9, -3, C.violet],
  [14, 3, C.gold],
  [20, -1, C.green],
  [26, 2, C.blue],
  [29, -4, C.gold],
  [35, 1, C.violet],
  [44, -2, C.green],
  [6, 5, C.gold],
  [24, 6, C.violet],
  [38, 5, C.blue],
  [46, 4, C.gold],
]
const isOnBall = (x: number, y: number) => x >= BALL_X - 1 && x <= BALL_X + 3 && y <= 4
function drawSpecks(b: PixelBuffer, time: number, isParty: boolean) {
  const { left, right, top } = areaOf(b)
  const w = right - left
  const shift = Math.floor(time * 2)
  const twinkle = every(time, 0.5)
  for (let tile = 0; tile * STAGE_W < w; tile++) {
    SPECKS.forEach(([sx, y, color], i) => {
      if (y < top) return
      const x = left + wrap(sx + tile * STAGE_W + shift, w)
      if (isOnBall(x, y)) return
      setPixel(b, x, y, fade(color, isParty && (i + twinkle) % 4 === 0 ? 0.35 : 0.72))
    })
  }
}

// Notes rising from the decks: one every other beat, from the left or the
// right deck in turn, drifting away from Clawd's face (left from the left
// deck, right from the right), dimmer as they rise.
const NOTE: Sprite = { palette: { x: 0xffffff }, frames: [['.xx', '.x.', '.x.', 'xx.']] }
const NOTE2: Sprite = { palette: { x: 0xffffff }, frames: [['xxxx', 'x..x', 'x..x', 'x.xx', 'xx..']] }
const NOTE_COLORS = [C.gold, C.blue, C.green, C.violet]
const NOTE_LIFE = 2.2
function drawNotes(b: PixelBuffer, t: number) {
  for (let k = 0; k < 6; k += 1) {
    if ((beatOf(t) - k) % 2 !== 0) continue
    const born = (beatOf(t) - k) * BEAT
    const age = t - born
    if (age < 0 || age > NOTE_LIFE) continue
    const n = wrap(beatOf(t) - k, 16)
    const isLeft = n % 4 < 2
    const x = Math.round(isLeft ? DECK_L + 1 - age * 2 : DECK_R + 3 + age * 2) + Math.round(Math.sin(age * 4 + n))
    const y = Math.round(BOOTH_TOP - 6 - age * 3.5)
    const color = NOTE_COLORS[n % 4]!
    const sprite = n % 4 === 2 ? NOTE2 : NOTE
    const c = age > NOTE_LIFE * 0.6 ? fade(color, 0.55) : fade(color, 0.15)
    drawSprite(b, { ...sprite, palette: { x: c } }, 0, x, y)
  }
}

// The wide room (72 columns and up): the dance floor runs from FLOOR_X to
// the far speaker, which takes the last FAR_ROOM columns.
export const WIDE_ROOM = 72
export const FLOOR_X = 45
const FAR_ROOM = 10

// The equaliser over the floor: bars two columns wide, three apart, each
// bar's height from a hand-made pattern of four beats, falling within the
// beat; green, gold then red at the top. Dim, so Clawd stays the centre.
const EQ_PATTERN: readonly (readonly number[])[] = [
  [3, 5, 2, 4, 6, 3, 1, 4],
  [2, 4, 5, 3, 4, 6, 2, 3],
  [4, 2, 3, 6, 3, 4, 5, 2],
  [5, 3, 4, 2, 5, 2, 4, 6],
]
function drawEqualiser(b: PixelBuffer, t: number) {
  const { right } = areaOf(b)
  const heights = EQ_PATTERN[beatOf(t) % EQ_PATTERN.length]!
  const decay = 1 - inBeat(t) * 0.6
  const end = right - (right >= WIDE_ROOM ? FAR_ROOM : 1)
  for (let x = FLOOR_X, i = 0; x + 1 < end; x += 3, i++) {
    const h = Math.max(1, Math.round(heights[i % heights.length]! * decay))
    for (let k = 0; k < h; k++) {
      const color = k >= 5 ? C.red : k >= 3 ? C.gold : C.green
      fillRect(b, x, 12 - k, 2, 1, fade(color, 0.6))
    }
  }
}

// The floor: tiles along the bottom row, dim, or at a party lighting up in
// turn with the beat.
function drawFloor(b: PixelBuffer, t: number, isParty: boolean) {
  const { left, right } = areaOf(b)
  const beat = beatOf(t)
  const TILES = [C.blue, C.violet, C.gold, C.green]
  for (let x = left, i = 0; x < right; x += 4, i++) {
    const isLit = isParty && (i + beat) % 3 === 0
    fillRect(b, x, 13, 3, 1, isLit ? fade(TILES[(i + beat) % 4]!, 0.45) : fade(C.gray, 0.82))
  }
}

// The dance floor's spots on an area this wide: from 72 columns, from
// FLOOR_X to the far speaker; narrower, from right of the near speaker to
// the edge (one spot at 48 columns). Eight at most, 10 columns apart.
export const DANCER_W = 7
export const SPOT_GAP = 10
export const NARROW_FLOOR_X = 41
export function djSpots(columns: number): Spots {
  const right = Math.max(STAGE_W, columns)
  const isWide = right >= WIDE_ROOM
  const from = isWide ? FLOOR_X : NARROW_FLOOR_X
  const end = isWide ? right - FAR_ROOM : right
  const count = Math.max(0, Math.min(MAX_SEATS, Math.floor((end - from - DANCER_W) / SPOT_GAP) + 1))

  return { count, x: spot => from + spot * SPOT_GAP }
}

// The dancers: each helper walks in from the right edge, dances at its
// spot (a hop on its beat, the dancers in turn, its claws up then; a step
// to the side and back every two beats), and walks out when its agent
// ends. In calm mode each one present stands at its spot.
function drawDancers(b: PixelBuffer, t: number, log: SeatLog, now: number, isCalm: boolean) {
  for (const e of log.entries) {
    if (isCalm) {
      if (isPresent(e, now)) drawStanding(b, { entry: e, pose: 'seated', x: homeX(e), stride: 0 }, homeX(e), WALKING_TOP, 'out')
      continue
    }
    const h = helperAt(e, now)
    if (!h) continue
    if (h.pose === 'walk-in' || h.pose === 'walk-out') {
      drawWalker(b, h)
      continue
    }
    if (h.pose === 'hop') {
      drawStanding(b, h, h.x, WALKING_TOP - 1, 'up')
      continue
    }
    const beat = beatOf(t)
    const isMine = (beat + e.seat) % 2 === 0 && inBeat(t) < 0.5
    const side = beat % 4 === 2 ? (e.seat % 2 === 0 ? 1 : -1) : 0
    drawStanding(b, h, h.x + side, WALKING_TOP - (isMine ? 1 : 0), isMine ? 'up' : 'out')
  }
}

// Now playing: a box over the dance floor, in front of everything, at the
// floor's left edge by the mirror ball, with the track as text, on the
// area's cells 1 to 3 (pixel rows 2 to 7), clear of the dancers below and
// of Clawd's pop-up at the left. Only on a wide room. Its text takes at
// most BOX_TEXT_MAX cells; a title too long for it scrolls: the start held
// SCROLL_HOLD s, then SCROLL_SPEED columns a second to the end, the end
// held, and from the start again; calm, it is cut with ~. Its frame is a
// steady gold (at a party, bright on each beat), and brightens once over
// PULSE_S when the track changes: a single slow pulse, well under the
// three flashes a second flashing guidelines allow.
const BOX = 0x15151a
// The frame and a column of padding on each side.
const BOX_W_EXTRA = 4
export const BOX_TEXT_MAX = 60
export const SCROLL_HOLD = 2
export const SCROLL_SPEED = 4
const PULSE_S = 1

// The part of a text (as characters) the box shows: all of it when it
// fits in room cells, else a window of room cells, `into` seconds after
// the track came on.
export function scrollWindow(chars: readonly string[], room: number, into: number): string {
  if (chars.length <= room) return chars.join('')
  const over = chars.length - room
  const cycle = SCROLL_HOLD * 2 + over / SCROLL_SPEED
  const k = wrap(into, cycle)
  const offset = k < SCROLL_HOLD ? 0 : Math.min(over, Math.floor((k - SCROLL_HOLD) * SCROLL_SPEED))

  return chars.slice(offset, offset + room).join('')
}

export const cutText = (chars: readonly string[], room: number): string => (chars.length <= room ? chars.join('') : `${chars.slice(0, Math.max(0, room - 1)).join('')}~`)

function drawNowPlaying(b: PixelBuffer, t: number, input: DjInput) {
  const { right, top } = areaOf(b)
  if (input.track === null || right < WIDE_ROOM) return
  const floorTo = right - FAR_ROOM
  const room = Math.min(BOX_TEXT_MAX, floorTo - FLOOR_X - 2 - BOX_W_EXTRA)
  if (room < 3) return
  const chars = [...input.track]
  const text = input.isCalm ? cutText(chars, room) : scrollWindow(chars, room, input.trackTime)
  const w = textCells(text) + BOX_W_EXTRA
  const x = FLOOR_X
  const y = top + 2
  const since = input.sinceChange
  const pulse = !input.isCalm && since !== null && since >= 0 && since < PULSE_S ? Math.sin((since / PULSE_S) * Math.PI) : 0
  const base = input.isParty && !input.isCalm && inBeat(t) >= 0.3 ? fade(C.gold, 0.25) : C.gold
  const edge = pulse > 0 ? mix(base, C.white, 0.7 * pulse) : base
  fillRect(b, x, y, w, 6, BOX)
  fillRect(b, x, y, w, 1, edge)
  fillRect(b, x, y + 5, w, 1, edge)
  fillRect(b, x, y, 1, 6, edge)
  fillRect(b, x + w - 1, y, 1, 6, edge)
  // The text on the box's dark, one character a cell, on its middle row
  // (the area's cell row 2).
  const col = x + (b.ox ?? 0) + 2
  const row = (y + (b.oy ?? 0) + 2) / 2
  for (let i = 0; i < textCells(text); i++) clearCell(b, col + i, row)
  fillRect(b, x + 2, y + 2, textCells(text), 2, BOX)
  drawText(b, col, row, text, C.paper)
}

// What a frame of the DJ picture is drawn from. time: seconds since the
// picture came on (the loop's clock; the specks drift on it); now: the
// mod's clock, for the dancers' walks; trackTime: seconds since the track
// came on (the box's scroll); sinceChange: seconds since the track
// changed while playing (null when it hasn't), for the record swap and
// the box's pulse; isParty: the full light show (/stage dj party).
export type DjInput = {
  track: string | null
  time: number
  now: number
  trackTime: number
  sinceChange: number | null
  dancers: SeatLog
  isCalm: boolean
  isParty: boolean
}

export function djScene(input: DjInput): Scene {
  return {
    id: 'dj',
    loop: DJ_LOOP,
    still: DJ_STILL,
    focusX: FOCUS_X,
    background: (b, time) => drawSpecks(b, time, input.isParty),
    backdrop: (b, t) => {
      drawFloor(b, t, input.isParty)
      drawEqualiser(b, t)
      drawBall(b, t, input.isParty)
      const { right } = areaOf(b)
      drawSpeaker(b, t, SPEAKER_X, right >= WIDE_ROOM, input.isParty)
      if (right >= WIDE_ROOM) drawSpeaker(b, t, right - 9, true, input.isParty)
    },
    actors: [
      {
        kind: 'clawd',
        isHero: true,
        at: t => ({ x: CLAWD_X, y: CLAWD_TOP + bobOf(t) }),
        look: t => {
          const isVibe = t >= VIBE && t < SCRATCH
          const isScratch = t >= SCRATCH && t < CHEER
          const isCheer = t >= CHEER
          const pump = beatOf(t) % 2 === 0

          return {
            pose: 'stand',
            eyes: isVibe ? 'closed' : isScratch ? 'wide' : 'open',
            isBlinking: !isVibe && !isScratch && blinking(t, 0.7),
            look: { x: isScratch ? 1 : 0, y: isCheer ? -1 : 0 },
            arms: isCheer ? { left: 'up', right: 'up' } : isVibe ? { left: 'down', right: 'down' } : isScratch ? { left: 'down', right: 'out' } : { left: 'down', right: pump ? 'up' : 'out' },
          }
        },
      },
      { kind: 'prop', z: 1, draw: drawPhones },
      { kind: 'prop', z: 2, draw: (b, t) => drawBooth(b, t, input.isCalm ? null : input.sinceChange, input.isParty) },
      { kind: 'prop', z: 3, draw: drawNotes },
      { kind: 'prop', z: 4, draw: (b, t) => drawDancers(b, t, input.dancers, input.now, input.isCalm) },
    ],
    front: (b, t) => drawNowPlaying(b, t, input),
  }
}

// A frame of the DJ picture on an area of this size: the scene at its time
// (calm: its still), cropped around Clawd where the area is narrower than
// the core.
export function djFrame(input: DjInput, size: AreaSize): PixelBuffer {
  const time = input.isCalm ? DJ_STILL : input.time
  const full = renderFull(djScene(input), time, null, time, size)

  return crop(full, FOCUS_X, size.columns)
}

// Where Clawd's head is on the area, for the pop-ups: its centre column
// and top row, the crop's start taken off.
export function djHead(input: DjInput, size: AreaSize): Point {
  const t = wrap(input.isCalm ? DJ_STILL : input.time, DJ_LOOP)
  const { w, ox, oy } = areaShape(size)

  return { x: CLAWD_X + CLAWD_W / 2 + ox - cropStart(w, FOCUS_X, size.columns), y: CLAWD_TOP + bobOf(t) + oy }
}
