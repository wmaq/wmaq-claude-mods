import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { createBuffer, EMPTY, fillRect, getPixel, setPixel } from './pixels'
import { CLAWD_TOP, crop, drawSprite, heroAt, overlay, renderFull, renderScene, type Scene, type Sprite, STAGE_H, STAGE_W, wipe } from './scene'

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

test('overlay and wipe combine frames', () => {
  const a = createBuffer(4, 1)
  fillRect(a, 0, 0, 4, 1, 1)
  const b = createBuffer(4, 1)
  setPixel(b, 3, 0, 2)
  expect([...overlay(a, b).px]).toEqual([1, 1, 1, 2])
  expect([...wipe(a, b, 0.5).px]).toEqual([EMPTY, EMPTY, 1, 1])
  expect([...wipe(a, b, 1).px]).toEqual([...b.px])
  expect(renderScene(scene, 0, 24).px).toHaveLength(24 * STAGE_H)
})
