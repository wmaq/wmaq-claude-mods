// The pictures as hashes, for the tests that hold a 48-column, 7-row area
// to them (phase 4e: on that size every picture draws exactly as it did).
// goldenHashes() samples each picture through areaCells, as the paint loop
// composes it, and hashes its frames; golden-table.ts holds the hashes,
// most of them 0.11.0's, and says which release gave the rest. A test-only
// module: the hooks never import it.

import { spawned } from './agents'
import { createDirector, react, withAuditing } from './director'
import { areaCells } from './frames'
import { CELEBRATE, DOZE_MS, IDLE_IDS, SHOW_OFF_DEMO } from './idle'
import { createMod, type Mod } from './mod'
import { STAGE_SIZE } from './scene'
import { SCENES } from './scenes'
import { WAITING_SCENE_IDS, type WaitingSceneId } from './waiting/deal'

const quiet = () => undefined

// FNV-1a, 32 bits, over a string's UTF-16 code units, as 8 hex digits.
export function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(16).padStart(8, '0')
}

// The area's frames on one mod, in time order, drawn at time 0 first.
function sample(mod: Mod, times: readonly number[]): string {
  mod.band.requestId = 'r1'
  areaCells(mod, STAGE_SIZE, 0, quiet)

  return times.map(t => areaCells(mod, STAGE_SIZE, t, quiet) ?? '').join('|')
}

const times = (count: number, every: number, from = 0): number[] => Array.from({ length: count }, (_, i) => from + i * every)

export function working(scene: string): Mod {
  const mod = createMod()
  mod.isBandWorking = true
  mod.idleSince = 0
  mod.director = createDirector(scene, false)

  return mod
}

export function idle(routine: string): Mod {
  const mod = createMod()
  mod.idle = routine
  mod.idleSince = 0

  return mod
}

export function waiting(scene: WaitingSceneId, agents: readonly string[]): Mod {
  const mod = createMod()
  mod.idleSince = 0
  mod.waiting = { ...mod.waiting, deal: { deck: [scene], last: undefined } }
  agents.forEach((name, i) => {
    mod.roster = spawned(mod.roster, `agent-${i + 1}`, name, 0)
  })

  return mod
}

// Each picture's name and its frames' hash.
export function goldenHashes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of Object.keys(SCENES)) {
    out[`scene:${id}`] = fnv1a(sample(working(id), times(16, 577)))
    for (const reaction of ['failure', 'advance'] as const) {
      const mod = working(id)
      mod.director = react(mod.director, reaction, 0)
      out[`scene:${id}:${reaction}`] = fnv1a(sample(mod, times(16, 200)))
    }
    const audited = working(id)
    audited.director = withAuditing(audited.director, true, 0)
    out[`scene:${id}:auditing`] = fnv1a(sample(audited, times(16, 250)))
  }
  for (const routine of [...IDLE_IDS, CELEBRATE, ...SHOW_OFF_DEMO]) out[`idle:${routine}`] = fnv1a(sample(idle(routine), times(16, 400)))
  out['idle:doze'] = fnv1a(sample(idle('classic'), times(16, 700, DOZE_MS)))
  for (const scene of WAITING_SCENE_IDS) {
    out[`waiting:${scene}`] = fnv1a(sample(waiting(scene, ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1']), times(16, 500)))
    const demo = waiting(scene, [])
    demo.demo = { kind: 'waiting', at: 0, scene, columns: 48 }
    out[`waiting-demo:${scene}`] = fnv1a(sample(demo, times(25, 1000)))
  }
  const work = createMod()
  work.idleSince = 0
  work.demo = { kind: 'work', at: 0, seconds: 3, scene: 'dice' }
  out['demo-work:dice'] = fnv1a(sample(work, times(14, 3000, 1500)))

  return out
}
