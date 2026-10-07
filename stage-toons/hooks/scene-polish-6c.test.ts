import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { type PixelBuffer } from './pixels'
import { type AreaSize, heroAt, renderFull, renderScene, type Scene, STAGE_SIZE } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { C } from './scenes/kit'
import { type Cast, heroOnScreen } from './toon'

// Phase 6c's scenes, each showing what it is about across the width (the
// rules every polished scene keeps are in scene-polish.test.ts).
const scene = (id: string): Scene => SCENES[id]!
const MID: AreaSize = { columns: 120, rows: 9 }
const draw = (id: string, t: number, size: AreaSize = MID) => renderFull(scene(id), t, null, t, size)
// A colour's pixels, in the core's coordinates.
const where = (b: PixelBuffer, ...colors: number[]) =>
  [...b.px].flatMap((c, i) => (colors.includes(c) ? [{ x: (i % b.w) - (b.ox ?? 0), y: Math.floor(i / b.w) - (b.oy ?? 0) }] : []))
const xs = (b: PixelBuffer, ...colors: number[]) => where(b, ...colors).map(p => p.x)

test("a reaction's camera keeps a walking Clawd in view: bricklaying mid-build in a 30-column toon", () => {
  const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }
  for (const t of [4, 8, 12]) {
    const head = heroOnScreen({ base: 'bricklaying', time: t, reaction: { id: 'failure', t: 0.5 } }, { columns: 30, rows: 7 }, cast)
    expect(`${t}: ${head.x - 7 >= 0 && head.x + 7 <= 30}`).toBe(`${t}: true`)
  }
  // A camera that pans away from a Clawd standing still holds on the scene's focus.
  const crash = heroOnScreen({ base: 'crash-test', time: 2, reaction: { id: 'failure', t: 0.5 } }, { columns: 30, rows: 7 }, cast)
  expect(crash.x - 7 >= 0 && crash.x + 7 <= 30).toBe(true)
  expect(STAGE_SIZE.columns).toBe(48)
})
