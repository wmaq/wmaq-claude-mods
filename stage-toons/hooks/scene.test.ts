import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { createBuffer, drawText, EMPTY, fillRect, getPixel, glyphAt, setPixel } from './pixels'
import { CLAWD_TOP, cellThreshold, crop, dissolve, drawSprite, FADE_MS, heroAt, LOOP_LAST_S, overlay, renderFull, renderScene, renderSeamed, type Scene, type Sprite, STAGE_H, STAGE_W } from './scene'

const dot: Sprite = { palette: { x: 0x111111, y: 0x222222 }, frames: [['x.'], ['.y']] }

const scene: Scene = {
  id: 'idle',
  loop: 2,
  focusX: 40,
  backdrop: b => setPixel(b, 0, 0, 0x333333),
  actors: [
    { kind: 'sprite', sprite: dot, frame: t => (t < 1 ? 0 : 1), at: t => ({ x: Math.floor(t * 10), y: 5 }) },
    { kind: 'clawd', isHero: true, at: () => ({ x: 20, y: CLAWD_TOP }), look: () => ({}) },
  ],
  front: b => setPixel(b, 47, 11, 0x444444),
}

test('sprites draw their frame and skip transparent pixels', () => {
  const b = createBuffer(4, 2)
  drawSprite(b, dot, 1, 1, 0)
  expect(getPixel(b, 2, 0)).toBe(0x222222)
  expect(getPixel(b, 1, 0)).toBe(EMPTY)
  drawSprite(b, dot, 2, 0, 1)
  expect(getPixel(b, 0, 1)).toBe(0x111111)
})

test('a mirrored sprite reads each row back to front', () => {
  const arrow: Sprite = { palette: { x: 0x111111, y: 0x222222 }, frames: [['xy.', '.xy']] }
  const b = createBuffer(3, 2)
  drawSprite(b, arrow, 0, 0, 0, true)
  expect([0, 1, 2].map(x => getPixel(b, x, 0))).toEqual([EMPTY, 0x222222, 0x111111])
  expect([0, 1, 2].map(x => getPixel(b, x, 1))).toEqual([0x222222, 0x111111, EMPTY])
})

test('a scene loops in time and paints backdrop, actors, then front', () => {
  const a = renderFull(scene, 0.5)
  expect(a.w).toBe(STAGE_W)
  expect(a.h).toBe(STAGE_H)
  expect(getPixel(a, 0, 0)).toBe(0x333333)
  expect(getPixel(a, 5, 5)).toBe(0x111111)
  expect(getPixel(a, 47, 11)).toBe(0x444444)
  expect([...renderFull(scene, 2.5).px]).toEqual([...a.px])
  expect(getPixel(renderFull(scene, 1.5), 16, 5)).toBe(0x222222)
})

test('the hero jumps and flinches on cue', () => {
  const still = renderFull(scene, 0)
  const jump = renderFull(scene, 0, 'jump')
  expect(getPixel(still, 22, CLAWD_TOP)).toBe(CLAWD_ORANGE)
  expect(getPixel(still, 22, CLAWD_TOP - 2)).toBe(EMPTY)
  expect(getPixel(jump, 22, CLAWD_TOP - 2)).toBe(CLAWD_ORANGE)
  expect([...renderFull(scene, 0, 'flinch').px]).not.toEqual([...still.px])
  expect(heroAt(scene, 0)).toEqual({ x: 27, y: CLAWD_TOP })
})

test('cropping keeps the focus in view and centres the scene in a wider raster', () => {
  const full = createBuffer(STAGE_W, STAGE_H)
  setPixel(full, 40, 0, 1)
  setPixel(full, 0, 0, 2)
  const narrow = crop(full, 40, 24)
  expect(narrow.w).toBe(24)
  expect(getPixel(narrow, 16, 0)).toBe(1)
  expect(getPixel(crop(full, 24, 50), 1, 0)).toBe(2)
  expect([...crop(full, 24, 48).px]).toEqual([...full.px])
})

test('overlay combines frames', () => {
  const a = createBuffer(4, 1)
  fillRect(a, 0, 0, 4, 1, 1)
  const b = createBuffer(4, 1)
  setPixel(b, 3, 0, 2)
  expect([...overlay(a, b).px]).toEqual([1, 1, 1, 2])
  expect(renderScene(scene, 0, 24).px).toHaveLength(24 * STAGE_H)
})

const solidOf = (color: number) => {
  const b = createBuffer(STAGE_W, STAGE_H)
  fillRect(b, 0, 0, STAGE_W, STAGE_H, color)

  return b
}
// How many of the 48 x 7 cells show the new frame.
const changed = (b: ReturnType<typeof createBuffer>) => {
  let n = 0
  for (let row = 0; row < STAGE_H / 2; row++) for (let x = 0; x < STAGE_W; x++) if (getPixel(b, x, row * 2) === 2) n++

  return n
}

test('a dissolve starts as the old frame and ends as the new one, a scattered half of the cells halfway', () => {
  const from = solidOf(1)
  const to = solidOf(2)
  expect([...dissolve(from, to, 0, 7).px]).toEqual([...from.px])
  expect([...dissolve(from, to, 1, 7).px]).toEqual([...to.px])
  for (const seed of [7, 1_000_123, 1_759_700_000_000]) {
    const n = changed(dissolve(from, to, 0.5, seed))
    expect(n).toBeGreaterThan(336 * 0.35)
    expect(n).toBeLessThan(336 * 0.65)
  }
  expect(FADE_MS).toBe(500)
})

test('in a dissolve, a cell that has changed stays changed, and its two pixels change together', () => {
  const from = solidOf(1)
  const to = solidOf(2)
  let before = dissolve(from, to, 0, 3)
  for (let p = 0.1; p <= 1.0001; p += 0.1) {
    const now = dissolve(from, to, p, 3)
    for (let i = 0; i < now.px.length; i++) if (before.px[i] === 2) expect(now.px[i]).toBe(2)
    for (let row = 0; row < STAGE_H / 2; row++) for (let x = 0; x < STAGE_W; x++) expect(getPixel(now, x, row * 2)).toBe(getPixel(now, x, row * 2 + 1))
    before = now
  }
})

test('two seeds give two orders', () => {
  const order = (seed: number) => Array.from({ length: 48 }, (_, x) => cellThreshold(x, 3, seed))
  expect(order(1)).not.toEqual(order(2))
  for (const v of order(1)) expect(v >= 0 && v < 1).toBe(true)
})

test("a fading scene's seam: its last moment, held, breaks up into the new loop, the background drifting on in both", () => {
  const seen: number[] = []
  const fading: Scene = {
    id: 'fading',
    loop: 2,
    focusX: 24,
    fadesAtLoop: true,
    actors: [],
    background: (b, time) => {
      seen.push(time)
    },
    backdrop: (b, t) => fillRect(b, 0, 0, STAGE_W, STAGE_H, t < 1 ? 2 : 1),
  }
  // In its first loop, no seam.
  expect([...renderSeamed(fading, 0.1).px]).toEqual([...renderFull(fading, 0.1).px])
  seen.length = 0
  const mid = renderSeamed(fading, 2.25)
  // Both halves drew the background at the frame's own time.
  expect(seen).toEqual([2.25, 2.25])
  const n = changed(mid)
  expect(n).toBeGreaterThan(336 * 0.35)
  expect(n).toBeLessThan(336 * 0.65)
  // The held half is the loop's last moment.
  expect(LOOP_LAST_S).toBe(0.05)
  expect([...new Set(renderFull(fading, 2 - LOOP_LAST_S).px)]).toEqual([1])
  expect([...renderSeamed(fading, 2.5).px]).toEqual([...renderFull(fading, 2.5).px])
  // A scene without the flag loops as before.
  const plain = { ...fading, fadesAtLoop: undefined }
  expect([...renderSeamed(plain, 2.25).px]).toEqual([...renderFull(plain, 2.25).px])
})

// A block over the top of Clawd's body (orange at x 22, CLAWD_TOP), at a
// depth.
const block = (z: number | ((t: number) => number)) => ({ kind: 'prop' as const, z, draw: (b: Parameters<typeof fillRect>[0]) => fillRect(b, 22, CLAWD_TOP, 2, 1, 0x555555) })
const withBlock = (z: number | ((t: number) => number)): Scene => ({
  id: 'depth',
  loop: 2,
  focusX: 24,
  actors: [block(z), { kind: 'clawd', isHero: true, at: () => ({ x: 20, y: CLAWD_TOP }), look: () => ({}) }],
})

test('actors paint by depth: a prop nearer than Clawd covers him, a farther one hides behind him', () => {
  expect(getPixel(renderFull(withBlock(1), 0), 22, CLAWD_TOP)).toBe(0x555555)
  expect(getPixel(renderFull(withBlock(-1), 0), 22, CLAWD_TOP)).toBe(CLAWD_ORANGE)
})

test('actors of equal depth paint in the order written', () => {
  // The block is written first, at Clawd's depth: he covers it.
  expect(getPixel(renderFull(withBlock(0), 0), 22, CLAWD_TOP)).toBe(CLAWD_ORANGE)
})

test("a depth that changes with the loop's time moves a prop from behind Clawd to in front", () => {
  const scene = withBlock(t => (t < 1 ? -1 : 1))
  expect(getPixel(renderFull(scene, 0.5), 22, CLAWD_TOP)).toBe(CLAWD_ORANGE)
  expect(getPixel(renderFull(scene, 1.5), 22, CLAWD_TOP)).toBe(0x555555)
  // Read at the loop's time: 3.5 s is 1.5 s into the second loop.
  expect(getPixel(renderFull(scene, 3.5), 22, CLAWD_TOP)).toBe(0x555555)
})

test('the backdrop and the front stay outermost, whatever the depths', () => {
  const scene: Scene = {
    ...withBlock(5),
    backdrop: b => fillRect(b, 0, 0, STAGE_W, STAGE_H, 0x010101),
    front: b => setPixel(b, 22, CLAWD_TOP, 0x020202),
    actors: [block(-5)],
  }
  const b = renderFull(scene, 0)
  expect(getPixel(b, 0, 0)).toBe(0x010101)
  expect(getPixel(b, 22, CLAWD_TOP)).toBe(0x020202)
  expect(getPixel(b, 23, CLAWD_TOP)).toBe(0x555555)
})

test("the background paints first and is given the scene's time unwrapped", () => {
  const seen: number[] = []
  const scene: Scene = {
    ...withBlock(0),
    background: (b, time) => {
      seen.push(time)
      fillRect(b, 0, 0, STAGE_W, STAGE_H, 0x0a0a0a)
    },
    backdrop: b => setPixel(b, 0, 0, 0x0b0b0b),
  }
  const b = renderFull(scene, 5.25)
  expect(seen).toEqual([5.25])
  expect(getPixel(b, 0, 0)).toBe(0x0b0b0b)
  expect(getPixel(b, 1, 0)).toBe(0x0a0a0a)
  expect(getPixel(b, 22, CLAWD_TOP)).toBe(CLAWD_ORANGE)
})

test("a dissolve carries each cell's character with its pixels", () => {
  const from = createBuffer(48, 14)
  drawText(from, 0, 0, 'x'.repeat(48), 0x111111)
  const to = createBuffer(48, 14)
  drawText(to, 0, 6, 'y'.repeat(48), 0x222222)
  const half = dissolve(from, to, 0.5, 9)
  for (let x = 0; x < 48; x++) {
    const isNew = cellThreshold(x, 0, 9) < 0.5
    expect(glyphAt(half, x, 0)).toEqual(isNew ? null : { cp: 0x78, fg: 0x111111 })
    expect(glyphAt(half, x, 6)).toEqual(cellThreshold(x, 6, 9) < 0.5 ? { cp: 0x79, fg: 0x222222 } : null)
  }
  expect(dissolve(createBuffer(4, 2), createBuffer(4, 2), 0.5, 1).text).toBe(undefined)
})

test("overlay keeps the base's characters where the top draws nothing, and the top's own", () => {
  const base = createBuffer(3, 2)
  drawText(base, 0, 0, 'abc', 0x111111)
  const top = createBuffer(3, 2)
  setPixel(top, 1, 1, 0xff0000)
  drawText(top, 2, 0, 'z', 0x222222)
  const out = overlay(base, top)
  expect(glyphAt(out, 0, 0)).toEqual({ cp: 0x61, fg: 0x111111 })
  expect(glyphAt(out, 1, 0)).toBe(null)
  expect(glyphAt(out, 2, 0)).toEqual({ cp: 0x7a, fg: 0x222222 })
  expect(glyphAt(base, 2, 0)).toEqual({ cp: 0x63, fg: 0x111111 })
})
