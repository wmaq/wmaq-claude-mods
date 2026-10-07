import { expect, test } from 'claude-code/testing'

import { react, withAuditing } from './director'
import { areaCells, layerAbove, sceneWithLayer } from './frames'
import { idle, waiting, working } from './golden'
import { CELEBRATE, DOZE_MS, IDLE_IDS, SHOW_OFF_DEMO } from './idle'
import type { Mod } from './mod'
import { getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, CLAWD_TOP, heroAt, renderFull, type Scene, STAGE_W } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { type Cast, composeFrame, heroOnScreen } from './toon'
import { WAITING_SCENE_IDS } from './waiting/deal'
import type { Layer } from './work'

const WIDTHS = [30, 47, 48, 49, 80, 120, 200, 512]
const ROWS = [7, 8, 9]
// Moments over two simulated minutes; a reaction's over its 2 s.
const MOMENTS = [0, 700, 13_000, 37_000, 61_000, 89_000, 119_000]
const REACTION_MOMENTS = [0, 300, 900, 1_500, 1_900]

const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }

// Draws a mod's area at each moment and size, as the paint loop does:
// nothing may break (a broken scene is logged and replaced), and every
// frame is exactly the area's size.
function drawsAtEverySize(name: string, make: () => Mod, moments: readonly number[], columns: number) {
  for (const rows of ROWS) {
    const size: AreaSize = { columns, rows }
    const mod = make()
    mod.band.requestId = 'r1'
    mod.band.columns = columns
    mod.band.rows = rows
    const broke: string[] = []
    for (const t of moments) {
      areaCells(mod, size, t, line => broke.push(line))
      const frame = mod.shown!.draw(t, size)
      expect(`${name} at ${columns}x${rows}: ${frame.w}x${frame.h}`).toBe(`${name} at ${columns}x${rows}: ${columns}x${rows * 2}`)
    }
    expect(broke).toEqual([])
    if (name.startsWith('waiting:')) expect(`${name} at ${columns}x${rows}: ${mod.seats.seats} seats`).toBe(`${name} at ${columns}x${rows}: ${columns >= 80 ? 8 : 4} seats`)
  }
}

for (const columns of WIDTHS) {
  test(`every work scene draws at ${columns} columns and 7, 8 and 9 rows, at its size`, () => {
    for (const id of Object.keys(SCENES)) drawsAtEverySize(id, () => working(id), MOMENTS, columns)
  })

  test(`every reaction and the auditor draw at ${columns} columns and 7, 8 and 9 rows, at their size`, () => {
    for (const id of Object.keys(SCENES)) {
      for (const reaction of ['failure', 'advance'] as const) {
        drawsAtEverySize(`${id}:${reaction}`, () => {
          const mod = working(id)
          mod.director = react(mod.director, reaction, 0)

          return mod
        }, REACTION_MOMENTS, columns)
      }
      drawsAtEverySize(`${id}:auditing`, () => {
        const mod = working(id)
        mod.director = withAuditing(mod.director, true, 0)

        return mod
      }, [0, 1_000, 2_500, 4_000], columns)
    }
  })

  test(`every idle routine, the doze and the waiting toon draw at ${columns} columns and 7, 8 and 9 rows, at their size`, () => {
    for (const routine of [...IDLE_IDS, CELEBRATE, ...SHOW_OFF_DEMO]) drawsAtEverySize(routine, () => idle(routine), MOMENTS, columns)
    drawsAtEverySize('doze', () => idle('classic'), MOMENTS.map(t => DOZE_MS + t), columns)
    const eight = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'x']
    for (const scene of WAITING_SCENE_IDS) {
      drawsAtEverySize(`waiting:${scene}`, () => waiting(scene, eight), MOMENTS.map(t => t / 4), columns)
      drawsAtEverySize(`waiting-demo:${scene}`, () => {
        const mod = waiting(scene, [])
        mod.demo = { kind: 'waiting', at: 0, scene, columns }

        return mod
      }, [0, 3_000, 9_000, 15_000, 21_000, 24_500], columns)
    }
  })
}

test("a frame's cells: about 17 KB at 120 columns by 9 rows, about 74 KB at 512", () => {
  const mod = working('dice')
  mod.band.requestId = 'r1'
  expect(areaCells(mod, { columns: 120, rows: 9 }, 0, () => undefined)!.length).toBe(120 * 9 * 16)
  expect(areaCells(mod, { columns: 512, rows: 9 }, 100, () => undefined)!.length).toBe(512 * 9 * 16)
})

test("the layer lands on Clawd's head at 120 columns: the badge is drawn where it is at 48", () => {
  const layer: Layer = { badge: 'thinking', what: '', bubble: null, t: 0 }
  // The columns of the area's top two rows the layer changed.
  const layerColumns = (columns: number) => {
    const size = { columns, rows: 7 }
    const shot = { base: 'workbench', time: 0, reaction: null }
    const plain = composeFrame({ ...shot, mood: 'think' as const }, size, cast)
    const withLayer = sceneWithLayer(shot, size, cast, layer)
    const changed: number[] = []
    for (let x = 0; x < columns; x++) if ([0, 1, 2, 3].some(y => getPixel(plain, x, y) !== getPixel(withLayer, x, y))) changed.push(x)

    return changed
  }
  expect(layerColumns(48).length > 0).toBe(true)
  expect(layerColumns(120)).toEqual(layerColumns(48))
  expect(heroOnScreen({ base: 'workbench', time: 0, reaction: null }, { columns: 120, rows: 9 }, cast)).toEqual({ x: 12, y: CLAWD_TOP + 4 })
  // A scene whose core starts further in takes its hero with it.
  const inset: Cast = { ...cast, scenes: { ...SCENES, workbench: { ...SCENES.workbench!, coreX: 10 } } }
  expect(heroOnScreen({ base: 'workbench', time: 0, reaction: null }, { columns: 120, rows: 9 }, inset).x).toBe(22)
})

test('at 9 rows the whole layer shows over every scene; at 8 rows at least the bubble', () => {
  const layer: Layer = { badge: 'thinking', what: 'Reading', bubble: 'Pushed!', t: 0 }
  for (const [id, scene] of Object.entries(SCENES)) {
    for (let i = 0; i < 24; i++) {
      const time = (scene.loop * i) / 24
      const shot = { base: id, time, reaction: null }
      expect(`${id} at ${time}: ${layerAbove(layer, heroOnScreen(shot, { columns: 120, rows: 9 }, cast).y) === layer}`).toBe(`${id} at ${time}: true`)
      expect(`${id} at ${time}: ${layerAbove(layer, heroOnScreen(shot, { columns: 120, rows: 8 }, cast).y)?.bubble}`).toBe(`${id} at ${time}: Pushed!`)
      expect(heroAt(scene, time).y >= 0).toBe(true)
    }
  }
})

// How many pixels right of the core differ between two pictures of a size.
function wingsDiffer(a: PixelBuffer, b: PixelBuffer): number {
  let n = 0
  for (let y = 0; y < a.h; y++) for (let x = STAGE_W; x < a.w; x++) if (getPixel(a, x, y) !== getPixel(b, x, y)) n++

  return n
}

// Scenes whose wings go on through the loop point by design rather than by a
// fixed step: thought-clouds' drift on unwrapped time (its own test), and
// the fading scenes' (their held last moment dissolves into the start; the
// phase's own are measured over the whole area in scene-polish.test.ts).
const UNSTEPPED = (s: Scene) => s.id === 'thought-clouds' || s.fadesAtLoop === true

for (const columns of [120, 200]) {
  test(`every loop is seamless across the wings at ${columns} columns: the step over the loop point is no bigger than any other`, () => {
    for (const s of Object.values(SCENES).filter(s => !UNSTEPPED(s))) {
      // The background held still: it drifts on unwrapped time, so it never
      // jumps at the loop point (a scrolling layer's steps fall where they
      // fall); the rule is the loop's.
      const draw = (time: number) => renderFull(s, time, null, 0, { columns, rows: 9 })
      // Every 0.05 s through the loop, so every step a wing takes is among them.
      const frames = Array.from({ length: Math.round(s.loop / 0.05) }, (_, i) => draw(0.025 + i * 0.05))
      const inside = Math.max(0, ...frames.slice(1).map((b, i) => wingsDiffer(frames[i]!, b)))
      const over = wingsDiffer(draw(s.loop - 0.025), draw(s.loop + 0.025))
      expect(`${s.id} at ${columns}: ${over <= inside}`).toBe(`${s.id} at ${columns}: true`)
    }
  })
}
