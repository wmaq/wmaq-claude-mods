import { expect, test } from 'claude-code/testing'

import { type Area, areaBuffer, areaFor, areaOf, CLAWD_TOP, focusAt, heroAt, renderFull, type Scene } from './scene'
import { reach } from './scenes/kit'

test('areaFor gives the area areaBuffer draws, at every width, height and core start', () => {
  for (const columns of [30, 47, 48, 49, 120, 512]) {
    for (const rows of [7, 8, 9]) {
      for (const coreX of [0, 10, 100]) {
        const size = { columns, rows }
        expect(areaFor(size, coreX)).toEqual(areaOf(areaBuffer(size, coreX)))
      }
    }
  }
  expect(areaFor({ columns: 120, rows: 9 })).toEqual({ left: 0, right: 120, top: -4 })
  expect(areaFor({ columns: 120, rows: 7 }, 10)).toEqual({ left: -10, right: 110, top: 0 })
  // Narrower than the core: the picture is drawn 48 wide, then cropped.
  expect(areaFor({ columns: 30, rows: 7 })).toEqual({ left: 0, right: 48, top: 0 })
})

// A scene whose hero stands 16 columns short of the right edge, noting
// every area its actors and its camera are given.
function edgeScene(seen: Area[]): Scene {
  return {
    id: 'edge',
    loop: 2,
    focusX: 24,
    focus: (_t, area) => {
      seen.push(area)

      return area.right - 24
    },
    actors: [
      {
        kind: 'clawd',
        isHero: true,
        at: (_t, area) => {
          seen.push(area)

          return { x: area.right - 16, y: CLAWD_TOP }
        },
        look: (_t, area) => {
          seen.push(area)

          return {}
        },
      },
    ],
  }
}

test('an actor and the camera are given the area: in renderFull, heroAt and focusAt', () => {
  const seen: Area[] = []
  const scene = edgeScene(seen)
  renderFull(scene, 0.5, null, 0.5, { columns: 120, rows: 9 })
  expect(seen).toEqual([{ left: 0, right: 120, top: -4 }, { left: 0, right: 120, top: -4 }])
  seen.length = 0
  expect(heroAt(scene, 0.5, { columns: 200, rows: 7 })).toEqual({ x: 191, y: CLAWD_TOP })
  expect(focusAt(scene, 0.5, { columns: 200, rows: 7 })).toBe(176)
  expect(seen).toEqual([{ left: 0, right: 200, top: 0 }, { left: 0, right: 200, top: 0 }])
  // With no size, the core's own.
  expect(heroAt(scene, 0.5)).toEqual({ x: 39, y: CLAWD_TOP })
  expect(focusAt(scene, 0.5)).toBe(24)
})

test("a scene's hero doesn't depend on the last render: no stale width", () => {
  const scene = edgeScene([])
  renderFull(scene, 0, null, 0, { columns: 512, rows: 9 })
  expect(heroAt(scene, 0).x).toBe(39)
  renderFull(scene, 0, null, 0, { columns: 48, rows: 7 })
  expect(heroAt(scene, 0, { columns: 200, rows: 9 }).x).toBe(191)
})

test('reach: up to its cap, a margin short of the edge, never below 0, inside the core at 48 columns', () => {
  const at = (columns: number) => areaFor({ columns, rows: 7 })
  expect(reach(at(48), 16, 150)).toBe(16)
  expect(16 + reach(at(48), 16, 150)).toBeLessThanOrEqual(48 - 16)
  expect(reach(at(120), 16, 150)).toBe(88)
  expect(reach(at(512), 16, 150)).toBe(150)
  expect(reach(at(120), 22, 150, 8)).toBe(90)
  expect(reach(at(48), 40, 150)).toBe(0)
})
