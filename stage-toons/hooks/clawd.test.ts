import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, type ClawdLook, clawdPixels, drawClawd, EYE_DARK, FABLE, FABLE_VIOLET, MONOCLE, type Pixel } from './clawd'
import { createBuffer, getPixel } from './pixels'

const count = (pixels: Pixel[], c: number) => pixels.filter(p => p.c === c).length

test('Clawd stands in a 14x8 box with two open eyes', () => {
  const px = clawdPixels()
  expect(Math.min(...px.map(p => p.y))).toBe(0)
  expect(Math.max(...px.map(p => p.y))).toBe(7)
  expect(count(px, CLAWD_ORANGE)).toBeGreaterThan(60)
  expect(count(px, EYE_DARK)).toBe(4)
})

test('blinking turns each eye into a line', () => {
  const eyes = clawdPixels({ isBlinking: true }).filter(p => p.c === EYE_DARK)
  expect(eyes).toHaveLength(4)
  expect([...new Set(eyes.map(p => p.y))]).toEqual([3])
})

test('Fable is violet, with a monocle', () => {
  const px = clawdPixels(FABLE)
  expect(count(px, CLAWD_ORANGE)).toBe(0)
  expect(count(px, FABLE_VIOLET)).toBeGreaterThan(60)
  expect(count(px, MONOCLE)).toBe(3)
})

test('walking moves the feet, jumping lifts them, sitting drops the body', () => {
  const feet = (look: Partial<ClawdLook>) =>
    clawdPixels(look)
      .filter(p => p.y >= 6)
      .map(p => `${p.x},${p.y}`)
      .sort()
      .join(' ')
  expect(feet({ pose: 'walk', stride: 0 })).not.toBe(feet({ pose: 'walk', stride: 2 }))
  expect(Math.max(...clawdPixels({ pose: 'jump' }).map(p => p.y))).toBe(6)
  expect(Math.min(...clawdPixels({ pose: 'sit' }).map(p => p.y))).toBe(2)
})

test('drawClawd paints into the buffer and answers its anchors there', () => {
  const b = createBuffer(48, 12)
  const anchors = drawClawd(b, 10, 4, { arms: { left: 'down', right: 'out' } })
  expect(getPixel(b, 12, 4)).toBe(CLAWD_ORANGE)
  expect(anchors.right).toEqual({ x: 25, y: 6 })
  expect(anchors.top).toEqual({ x: 17, y: 3 })
  expect(anchors.feet).toEqual({ x: 17, y: 12 })
})
