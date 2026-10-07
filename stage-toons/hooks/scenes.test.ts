import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK, FABLE_VIOLET } from './clawd'
import { createBuffer, getPixel, type PixelBuffer } from './pixels'
import { CLAWD_TOP, focusAt, heroAt, renderFull, renderScene, type Scene, STAGE_H, STAGE_W } from './scene'
import { REACTIONS, SCENES, STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW } from './workflow'
import { C, drawStarfield, line, STAR_LAYERS } from './scenes/kit'

const LIBRARY = [
  'road-trip', 'light-bulbs', 'writing-desk', 'proofread-page', 'stepping-stones', 'proofread-checklist', 'bricklaying', 'test-tubes', 'gift',
  'sweeping', 'bug-hunt', 'mystery-box', 'fable-audit', 'standing',
  'stargazing', 'sticky-notes', 'blueprint', 'red-pen',
  'dominoes', 'clipboard', 'terminal', 'control-panel',
  'waiting-bench', 'dishes', 'flashlight', 'fishing',
  'treasure-map', 'thought-clouds', 'scroll', 'stamp',
  'ladder', 'scales', 'workbench', 'crash-test',
  'cake', 'recycling', 'bug-net', 'dice',
  'fireworks', 'rocket',
]

const SCENE_LIST: Scene[] = Object.values(SCENES)

const count = (b: PixelBuffer, color: number) => [...b.px].filter(c => c === color).length

// One test a width, each well inside the kit's 5 s on a loaded machine.
for (const width of [24, 30, 48]) {
  test(`every scene renders at every moment and mood at ${width} columns without throwing`, () => {
    for (const scene of SCENE_LIST) {
      for (let t = 0; t <= 30; t += 0.1) {
        const b = renderScene(scene, t, width)
        expect(b.w).toBe(width)
        expect(b.h).toBe(STAGE_H)
      }
      for (const mood of ['jump', 'flinch'] as const) renderFull(scene, 1.3, mood)
    }
  })
}

test('Clawd is on stage throughout every scene', () => {
  for (const scene of SCENE_LIST) {
    for (let t = 0.013; t < scene.loop; t += 0.1) expect(count(renderFull(scene, t), CLAWD_ORANGE)).toBeGreaterThan(40)
  }
})

test('Clawd stands on the bottom row of a 14-pixel stage, with six pixels of headroom', () => {
  const b = renderFull(SCENES.standing!, 0)
  const rows = [...b.px].flatMap((c, i) => (c === CLAWD_ORANGE ? [Math.floor(i / b.w)] : []))
  expect(STAGE_H).toBe(14)
  expect(Math.min(...rows)).toBe(6)
  expect(Math.max(...rows)).toBe(STAGE_H - 1)
})

// The gold pixels' columns and rows, and the box's outer columns.
const goldOf = (b: PixelBuffer) => [...b.px].flatMap((c, i) => (c === C.gold ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))

test('the Other scene shows one question mark, whole and centred over the box', () => {
  for (let t = 0.013; t < SCENES['mystery-box']!.loop; t += 0.05) {
    const b = renderFull(SCENES['mystery-box']!, t)
    const gold = goldOf(b)
    expect(gold).toHaveLength(5)
    const box = [...b.px].flatMap((c, i) => (c === C.woodDark ? [i % b.w] : []))
    const centre = (Math.min(...box) + Math.max(...box)) / 2
    const dot = gold.reduce((a, p) => (p.y > a.y ? p : a))
    if (Math.min(...box) === 28) expect(dot.x).toBe(centre)
  }
})

test("the auditor's question mark shows whole", () => {
  expect(goldOf(renderFull(SCENES['fable-audit']!, 1))).toHaveLength(5)
})

// Scenes whose hero walks on through the loop and the fade at its loop
// point brings back to the start.
const WALKS_ON = ['bricklaying', 'sticky-notes']

test('every loop is seamless: the hero ends where it began, or the fade brings him back', () => {
  for (const scene of SCENE_LIST.filter(s => !WALKS_ON.includes(s.id))) {
    const start = heroAt(scene, 0)
    const end = heroAt(scene, scene.loop - 1 / 12)
    expect(Math.abs(start.x - end.x) + Math.abs(start.y - end.y)).toBeLessThanOrEqual(2)
  }
})

test('every scene is filed under its own name: the library', () => {
  for (const [id, scene] of Object.entries(SCENES)) expect(scene.id).toBe(id)
  expect(Object.keys(SCENES).sort()).toEqual([...LIBRARY].sort())
  expect(STAGE_SCENES).toEqual(Object.keys(SCENES).filter(n => n !== 'fable-audit' && n !== 'standing'))
  for (const s of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) for (const id of s.scenes) expect(STAGE_SCENES).toContain(id)
})

test('in the auditor scene both Clawds are on stage', () => {
  for (let t = 0.013; t < SCENES['fable-audit']!.loop; t += 0.1) {
    const b = renderFull(SCENES['fable-audit']!, t)
    expect(count(b, CLAWD_ORANGE)).toBeGreaterThan(40)
    expect(count(b, FABLE_VIOLET)).toBeGreaterThan(40)
  }
})

test('reactions draw without throwing and set the hero mood', () => {
  const hero = { x: 24, y: CLAWD_TOP }
  for (const reaction of Object.values(REACTIONS)) {
    for (let t = 0; t < 3; t += 0.1) reaction.draw(createBuffer(STAGE_W, STAGE_H), t, hero)
  }
  const failure = createBuffer(STAGE_W, STAGE_H)
  REACTIONS.failure.draw(failure, 0.7, hero)
  expect(count(failure, C.red)).toBeGreaterThan(0)
  expect(REACTIONS.failure.mood?.(0.1)).toBe('flinch')
  expect(REACTIONS.advance.mood?.(0.1)).toBe('jump')
  expect(REACTIONS.advance.mood?.(2)).toBeNull()
})

test('Fable walks in from off stage to its place, and back out', () => {
  const fableAt = (id: 'fable-arrives' | 'fable-leaves', t: number) => {
    const b = createBuffer(STAGE_W, STAGE_H)
    REACTIONS[id].draw(b, t, { x: 24, y: CLAWD_TOP })

    return count(b, FABLE_VIOLET)
  }
  expect(fableAt('fable-arrives', 0)).toBe(0)
  expect(fableAt('fable-arrives', 1.99)).toBeGreaterThan(40)
  expect(fableAt('fable-leaves', 0.01)).toBeGreaterThan(40)
  expect(fableAt('fable-leaves', 2)).toBe(0)
})

test('bug-hunt: the bug and the magnifying glass are on stage throughout', () => {
  for (let t = 0.013; t < SCENES['bug-hunt']!.loop; t += 0.1) {
    const b = renderFull(SCENES['bug-hunt']!, t)
    expect(count(b, C.red)).toBeGreaterThan(1)
    expect(count(b, C.glass)).toBeGreaterThan(2)
  }
})

const has = (id: string, color: number, t: number) => count(renderFull(SCENES[id]!, t), color)

test('batch 1, part 1: each new scene shows what it is about', () => {
  // Stars come out one by one; a shooting star crosses at 4.2 s.
  expect(has('stargazing', C.white, 0.1) + has('stargazing', C.gold, 0.1)).toBeLessThan(has('stargazing', C.white, 3.1) + has('stargazing', C.gold, 3.1))
  // The telescope alone is 5 gray pixels.
  expect(has('stargazing', C.gray, 1)).toBeGreaterThan(4)
  // Notes go up on the board, five by the end.
  expect(has('sticky-notes', C.blue, 1.5)).toBe(0)
  expect(has('sticky-notes', C.blue, 3)).toBe(9)
  // The plan's lines are drawn out on the blue board.
  expect(has('blueprint', C.white, 0.5)).toBeLessThan(has('blueprint', C.white, 4.9))
  // Mistakes are circled in red, then ticked in green.
  expect(has('red-pen', C.red, 0.5)).toBe(8)
  expect(has('red-pen', C.green, 5)).toBe(12)
})

test('every default stage lists its batch-1 scene second', () => {
  const second = (id: string) => [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side].find(s => s.id === id)?.scenes[1]
  expect([second('roadmap'), second('brainstorm'), second('spec'), second('spec-audit')]).toEqual(['stargazing', 'sticky-notes', 'blueprint', 'red-pen'])
  expect([second('plan'), second('plan-audit'), second('develop'), second('claude-test')]).toEqual(['dominoes', 'clipboard', 'terminal', 'control-panel'])
  expect([second('user-test'), second('cleanup'), second('debugging'), second('other')]).toEqual(['waiting-bench', 'dishes', 'flashlight', 'fishing'])
})

test('batch 1, part 2: each new scene shows what it is about', () => {
  // Dominoes go up one by one, then all lie flat.
  expect(has('dominoes', C.paper, 0.1)).toBeLessThan(has('dominoes', C.paper, 3.9))
  const standing = (t: number) => [...renderFull(SCENES.dominoes!, t).px].filter((c, i) => c === C.paper && Math.floor(i / 48) === 9).length
  expect(standing(4)).toBe(8)
  expect(standing(6.5)).toBe(0)
  // The clipboard's lines get ticked.
  expect(has('clipboard', C.green, 0.5)).toBe(1)
  expect(has('clipboard', C.green, 7.5)).toBe(4)
  // Code scrolls up the screen.
  expect([...renderFull(SCENES.terminal!, 0.1).px]).not.toEqual([...renderFull(SCENES.terminal!, 0.5).px])
  // Red, red, then green.
  expect(has('control-panel', C.red, 1)).toBe(12)
  expect(has('control-panel', C.green, 4)).toBe(12)
})

test('batch 1, part 3: each new scene shows what it is about', () => {
  // The clock's hand moves.
  expect([...renderFull(SCENES['waiting-bench']!, 0.1).px]).not.toEqual([...renderFull(SCENES['waiting-bench']!, 0.6).px])
  // The dirty stack shrinks as the clean one grows.
  expect(has('dishes', C.white, 0.5)).toBeLessThan(has('dishes', C.white, 4.5))
  // The beam finds the bug: its back shows red only once the light is on it.
  const bugBack = (t: number) => getPixel(renderFull(SCENES.flashlight!, t), 39, 11)
  expect(bugBack(0.5)).not.toBe(C.red)
  expect(bugBack(6.5)).toBe(C.red)
  expect(has('flashlight', C.beam, 1)).toBeGreaterThan(20)
  // A boot, then a fish.
  expect(has('fishing', C.darkGray, 3.5)).toBeGreaterThan(5)
  expect(has('fishing', C.green, 7)).toBeGreaterThan(5)
})

test('the fishing ripples meet themselves at the loop point', () => {
  // The scene wraps from t = 8 back to 0: the water must look the same at
  // both, or the ripples jump there.
  const scene = SCENES.fishing!
  const water = (t: number) => {
    const b = createBuffer(STAGE_W, STAGE_H)
    scene.backdrop?.(b, t)

    return [...b.px].slice(11 * STAGE_W, 12 * STAGE_W)
  }
  expect(water(scene.loop)).toEqual(water(0))
})

test('the kit never uses Clawd orange or Fable violet', () => {
  for (const color of Object.values(C)) expect([CLAWD_ORANGE, FABLE_VIOLET]).not.toContain(color)
})

test('every default stage has three scenes after batch 2', () => {
  for (const s of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) expect(s.scenes).toHaveLength(3)
})

test('every default stage lists its batch-2 scene third', () => {
  expect([...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side].map(s => s.scenes[2])).toEqual([
    'treasure-map', 'thought-clouds', 'scroll', 'stamp', 'ladder', 'scales',
    'workbench', 'crash-test', 'cake', 'recycling', 'bug-net', 'dice',
  ])
})

// Where a colour is at a moment of a scene.
const at = (id: string, color: number, t: number) => {
  const b = renderFull(SCENES[id]!, t)

  return [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
}

const BATCH_2 = [
  'treasure-map', 'thought-clouds', 'scroll', 'stamp', 'ladder', 'scales',
  'workbench', 'crash-test', 'cake', 'recycling', 'bug-net', 'dice',
]

// crash-test's camera leaves Clawd for the wall from the roll to the pan
// back (0.4 to 2.8 s).
const isOnWall = (id: string, t: number) => id === 'crash-test' && t > 0.5 && t < 2.8

test('batch 2: at 30 columns, the narrowest the demo plays at, the crop still shows most of Clawd', () => {
  for (const id of BATCH_2) {
    const scene = SCENES[id]!
    for (let t = 0.013; t < scene.loop; t += 0.1) if (!isOnWall(id, t)) expect(count(renderScene(scene, t, 30), CLAWD_ORANGE)).toBeGreaterThan(40)
  }
})

test('batch 2: no scene jumps at its loop point', () => {
  const changed = (a: PixelBuffer, b: PixelBuffer) => [...a.px].filter((c, i) => c !== b.px[i]).length
  for (const id of [...BATCH_2, 'dishes']) {
    const scene = SCENES[id]!
    expect(changed(renderFull(scene, scene.loop - 0.02), renderFull(scene, 0.02))).toBeLessThan(30)
  }
})

test("batch 2: no prop covers Clawd's eyes", () => {
  for (const id of BATCH_2) {
    const scene = SCENES[id]!
    for (let t = 0.013; t < scene.loop; t += 0.1) {
      const b = renderFull(scene, t)
      const head = heroAt(scene, t)
      // His eyes sit in the 14 x 8 box below his head's top row.
      const eyes = [...b.px].filter((c, i) => c === EYE_DARK && Math.abs((i % b.w) - head.x) <= 7 && Math.floor(i / b.w) >= head.y && Math.floor(i / b.w) < head.y + 8)
      expect(eyes.length).toBeGreaterThanOrEqual(4)
    }
  }
})

test('batch 2, part 1: each new scene shows what it is about', () => {
  // The map unrolls, then the path's pins and the red X show up on it.
  expect(has('treasure-map', C.paper, 0.2)).toBeLessThan(has('treasure-map', C.paper, 2))
  expect(has('treasure-map', C.red, 1)).toBe(0)
  expect(has('treasure-map', C.red, 3.6)).toBe(2)
  expect(has('treasure-map', C.red, 5)).toBe(7)
  // No cloud at first; three puffs; then one big cloud.
  expect(has('thought-clouds', C.white, 0.2)).toBe(0)
  expect(has('thought-clouds', C.white, 2.2)).toBeGreaterThan(20)
  expect(has('thought-clouds', C.white, 4)).toBeGreaterThan(has('thought-clouds', C.white, 2.2))
  // The scroll unrolls along the floor, written as it goes.
  expect(has('scroll', C.paper, 0.5)).toBeLessThan(has('scroll', C.paper, 5))
  expect(has('scroll', C.ink, 0.5)).toBeLessThan(has('scroll', C.ink, 5))
  // stamp, reworked in phase 6c: scene-polish-6c.test.ts.
})

test('batch 2, part 2: each new scene shows what it is about', () => {
  // The rungs go up one by one; Clawd climbs to the top and comes down.
  expect(has('ladder', C.woodDark, 0.1)).toBe(0)
  expect(has('ladder', C.woodDark, 2.8)).toBe(18)
  expect(heroAt(SCENES.ladder!, 6.5).y).toBe(0)
  expect(heroAt(SCENES.ladder!, 9.9)).toEqual(heroAt(SCENES.ladder!, 0))
  // The beam tilts until the second block levels it, and a tick shows.
  const beamRows = (t: number) => new Set(at('scales', C.wood, t).map(p => p.y)).size
  expect(beamRows(0.5)).toBeGreaterThan(1)
  expect(beamRows(3.5)).toBe(1)
  expect(has('scales', C.green, 0.5)).toBe(0)
  expect(has('scales', C.green, 3.5)).toBe(5)
  // The robot is built, its eye lights up blue, and it walks away.
  expect(has('workbench', C.gray, 0.1)).toBe(0)
  expect(has('workbench', C.gray, 3)).toBeGreaterThan(has('workbench', C.gray, 1))
  expect(has('workbench', C.blue, 3)).toBe(0)
  expect(has('workbench', C.blue, 3.7)).toBe(1)
  expect(has('workbench', C.gray, 6.6)).toBe(0)
  // The cart rolls up to the wall, which bangs, and bounces back.
  const cartX = (t: number) => Math.min(...at('crash-test', C.blue, t).map(p => p.x))
  expect(cartX(0.2)).toBeLessThan(cartX(1.5))
  expect(cartX(3)).toBeLessThan(cartX(1.5))
  expect(has('crash-test', C.gold, 1)).toBe(0)
  expect(has('crash-test', C.gold, 1.7)).toBeGreaterThan(0)
})

test('batch 2, part 3: each new scene shows what it is about', () => {
  // The cake is carried beside Clawd, then sits on the table.
  const cakeX = (t: number) => Math.min(...at('cake', C.red, t).filter(p => p.y > 4).map(p => p.x))
  expect(cakeX(0.1)).toBeLessThan(25)
  expect(cakeX(3)).toBe(32)
  expect(cakeX(7.9)).toBe(cakeX(0))
  // The third ball misses the bin: it lies on the floor past it.
  expect(at('recycling', C.white, 4.5).every(p => p.x >= 44 && p.y >= 11)).toBe(true)
  expect(has('recycling', C.white, 4.5)).toBe(2)
  // The bug is caught inside the net's hoop.
  expect(at('bug-net', C.red, 4.5).every(p => p.x >= 32 && p.x <= 36 && p.y >= 3 && p.y <= 6)).toBe(true)
  expect(has('bug-net', C.red, 4.5)).toBe(2)
  // It stays caught: the net comes back up with it as the next bug flies in.
  const red = at('bug-net', C.red, 5.7)
  expect(red.filter(p => p.x >= 17 && p.x <= 21 && p.y <= 3)).toHaveLength(2)
  expect(red.filter(p => p.x >= 38)).toHaveLength(2)
  // The dice land on a double six: twelve pips (Clawd's eyes are ink too).
  expect(at('dice', C.ink, 3).filter(p => p.x >= 26)).toHaveLength(12)
  expect([...renderFull(SCENES.dice!, 1).px]).not.toEqual([...renderFull(SCENES.dice!, 1.15).px])
})

test('the kit draws a line with both ends and every pixel between', () => {
  const b = createBuffer(8, 8)
  line(b, 1, 1, 5, 3, C.gray)
  const px = [...b.px].flatMap((c, i) => (c === C.gray ? [[i % 8, Math.floor(i / 8)]] : []))
  expect(px).toContainEqual([1, 1])
  expect(px).toContainEqual([5, 3])
  expect(px).toHaveLength(5)
})

test("polish: the quill's shaft runs from Clawd's claw to its nib on the scroll", () => {
  for (const t of [1, 1.15, 6.5]) {
    const b = renderFull(SCENES.scroll!, t)
    expect(b.px[10 * b.w + 16]).toBe(CLAWD_ORANGE)
    expect(b.px[10 * b.w + 17]).toBe(C.white)
    expect(b.px[11 * b.w + 18]).toBe(C.ink)
  }
})

test('polish: the thought clouds swell into the big cloud and thin away a step at a time', () => {
  const white = (t: number) => has('thought-clouds', C.white, t)
  // Touching puffs, a fuller cloud, the full one.
  expect(white(3.65)).toBeLessThan(white(3.8))
  expect(white(3.8)).toBeLessThan(white(4))
  // Full, middle-sized, a puff, a wisp.
  expect(white(5.3)).toBeGreaterThan(white(5.5))
  expect(white(5.5)).toBeGreaterThan(white(5.7))
  expect(white(5.7)).toBeGreaterThan(white(5.9))
  expect(white(5.9)).toBeGreaterThan(0)
})

test("polish: crash-test's camera shows the wall and the bang in a narrow toon, and Clawd before and after", () => {
  const scene = SCENES['crash-test']!
  for (const width of [24, 30]) {
    const bang = renderScene(scene, 1.7, width)
    expect(count(bang, C.gold)).toBeGreaterThan(0)
    expect(count(bang, C.brick)).toBe(count(renderFull(scene, 1.7), C.brick))
    for (const t of [0.2, 3.2]) expect(count(renderScene(scene, t, width), CLAWD_ORANGE)).toBeGreaterThan(40)
  }
})

test('polish: the dishes clear away before their loop starts again; the wall grows to its end, then fades', () => {
  // All five dishes clean, then none in view as the dirty ones drop in.
  expect(has('dishes', C.white, 5.05) - has('dishes', C.white, 5.6)).toBeGreaterThanOrEqual(20)
  // The wall grows from column 6, bay by bay, and stands whole by 13.5 s; the
  // fade at the loop point clears it (scenes with fadesAtLoop).
  const bricks = (t: number) => at('bricklaying', C.brick, t)
  expect(bricks(0.1)).toHaveLength(0)
  expect(bricks(4).length).toBeLessThan(bricks(9).length)
  expect(Math.min(...bricks(13.6).map(p => p.x))).toBe(6)
  expect(bricks(15.9)).toEqual(bricks(13.6))
  expect(SCENES.bricklaying!.fadesAtLoop).toBe(true)
})

test("polish: a scene's camera moves a few columns a frame at most, and is back at its focus at the loop point", () => {
  for (const scene of SCENE_LIST) {
    let last = focusAt(scene, 0)
    expect(last).toBe(scene.focusX)
    for (let t = 1 / 12; t <= scene.loop; t += 1 / 12) {
      const now = focusAt(scene, t)
      expect(Math.abs(now - last)).toBeLessThanOrEqual(6)
      last = now
    }
    if (!WALKS_ON.includes(scene.id)) expect(focusAt(scene, scene.loop - 0.001)).toBe(scene.focusX)
  }
})

test('fireworks: three rockets burst one after another, in gold, blue and green, eight sparks each; the sky is clear between them', () => {
  const sky = (t: number) => [C.gold, C.blue, C.green].map(color => count(renderFull(SCENES.fireworks!, t), color))
  expect(sky(0.5)).toEqual([0, 0, 0])
  expect(sky(1.1)).toEqual([8, 0, 0])
  expect(sky(3.0)).toEqual([0, 0, 0])
  expect(sky(4.2)).toEqual([0, 8, 0])
  expect(sky(7.0)).toEqual([0, 0, 8])
  expect(sky(7.9)).toEqual([0, 0, 0])
  expect(SCENES.fireworks!.loop).toBe(8)
})

test('the starfield: each depth in its colour, drifting left at its own speed, wrapping at 48 columns', () => {
  const lit = (time: number, layer: 'far' | 'middle' | 'near') => {
    const b = createBuffer(STAGE_W, STAGE_H)
    drawStarfield(b, time, [layer])

    return [...b.px].flatMap((c, i) => (c === STAR_LAYERS[layer].color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
  }
  expect(STAR_LAYERS.far.speed).toBe(2)
  expect(STAR_LAYERS.middle.speed).toBe(4)
  expect(STAR_LAYERS.near.speed).toBe(6)
  expect([STAR_LAYERS.far.color, STAR_LAYERS.middle.color, STAR_LAYERS.near.color]).toEqual([C.darkGray, C.paperShade, C.white])
  for (const layer of ['far', 'middle'] as const) {
    const { speed, stars } = STAR_LAYERS[layer]
    expect(lit(0, layer)).toHaveLength(stars.length)
    // One second on, each star is speed columns further left, wrapping.
    const moved = stars.map(s => ({ x: (((s.x - speed) % 48) + 48) % 48, y: s.y }))
    const key = (ps: { x: number; y: number }[]) => JSON.stringify([...ps].sort((p, q) => p.y - q.y || p.x - q.x))
    expect(key(lit(1, layer))).toBe(key(moved))
  }
  // Near stars twinkle: about half show at a time, the others the next quarter second.
  const near = STAR_LAYERS.near.stars.length
  expect(lit(0, 'near').length + lit(0.25, 'near').length).toBe(near)
})

test('stargazing, fireworks and the rocket have a drifting night sky behind them, and only they among the scenes', () => {
  // thought-clouds' background is its wings' clouds, and waiting-bench's its
  // wings' ticket display, drawn only right of column 48: no sky behind the
  // core. road-trip's and bricklaying's are their scrolling scenery.
  const NOT_SKIES = ['thought-clouds', 'waiting-bench', 'road-trip', 'bricklaying']
  const withSky = Object.values(SCENES).filter(s => s.background !== undefined && !NOT_SKIES.includes(s.id)).map(s => s.id)
  expect(withSky.sort()).toEqual(['fireworks', 'rocket', 'stargazing'])
  for (const id of withSky) {
    const scene = SCENES[id]!
    const grey = (time: number) => [...renderFull(scene, time).px].filter(c => c === C.darkGray).length
    expect(grey(0.1)).toBeGreaterThan(5)
    // The sky moves on through the loop point.
    expect([...renderFull(scene, scene.loop + 0.1).px]).not.toEqual([...renderFull(scene, 0.1).px])
  }
})

test('bug-net: the free bug loops round behind Clawd, then back out in front of him', () => {
  const scene = SCENES['bug-net']!
  const red = (t: number) => [...renderFull(scene, t).px].flatMap((c, i) => (c === C.red ? [{ x: i % STAGE_W, y: Math.floor(i / STAGE_W) }] : []))
  // Behind him at its farthest left: hidden by his body.
  expect(red(1.6)).toHaveLength(0)
  // On the way back, in front of his body (x 7 to 19).
  expect(red(2.6).some(p => p.x >= 7 && p.x <= 19)).toBe(true)
})

test('light-bulbs: one idea peeks up from behind Clawd, another pops up in front of him', () => {
  const scene = SCENES['light-bulbs']!
  const behind = renderFull(scene, 2.5)
  // The bulb at (19, 4): its glass shows above his head, its lower rows are behind him.
  expect(behind.px[4 * STAGE_W + 20]).toBe(C.gold)
  expect(behind.px[6 * STAGE_W + 20]).toBe(CLAWD_ORANGE)
  // The bulb at (28, 8), over his body.
  expect(renderFull(scene, 3.75).px[9 * STAGE_W + 29]).toBe(C.gold)
})
