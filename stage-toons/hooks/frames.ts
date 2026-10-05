// Which frame the area shows at a moment, from the mod's state and the time
// alone: no engine. Composing moves the mod on as the loop goes (the seat
// log, the director's clock), and failures go to the log passed in.

import { cropLeft, placeIdle } from './area'
import { demoAt, demoStep, idleDemoAt } from './demo'
import { shot, tick } from './director'
import { DOZE_MS, FALLBACK_ROUTINE, idleFrame } from './idle'
import { type Mod, reseat } from './mod'
import { encodeCells } from './pixels'
import { REACTIONS, SCENES } from './scenes'
import { type Cast, composeFrame } from './toon'
import { waitingFrame } from './waiting'
import { waitingDemoAt } from './waiting/demo'

export type Log = (text: string) => void

// The mod's one Cast, built on the first frame. It keeps the first log it
// was given: the hooks hand every frame the same one (register.tsx's
// debugLog($)), and the frame tool makes a fresh mod per run.
export function castOf(mod: Mod, log: Log): Cast {
  mod.cast ??= {
    scenes: SCENES,
    reactions: REACTIONS,
    broken: mod.broken,
    onBreak: (id, error) => log(`stage-toons: scene ${id} failed and was replaced by the standing scene: ${String(error)}`),
  }

  return mod.cast
}

// The area's next frame, cut to its width, or null once the demo it plays
// is over: a demo, else the stage's scene while Claude works, else the
// waiting toon while a waiting period lasts, else the idle routine. The
// seat log moves on first, whichever plays.
export function areaCells(mod: Mod, columns: number, now: number, log: Log): string | null {
  const onBreak = (id: string, error: unknown) => log(`stage-toons: idle routine ${id} failed and was replaced by classic: ${String(error)}`)
  const idleAt = (ms: number) => cropLeft(placeIdle(idleFrame(mod.idle, ms, mod.brokenIdle, onBreak)), columns)
  reseat(mod, now)
  const demo = mod.demo
  if (demo?.kind === 'scenes') {
    const frame = demoAt(demo, now)

    return frame ? encodeCells(composeFrame(frame.shot, frame.sceneMs, columns, castOf(mod, log))) : null
  }
  if (demo?.kind === 'idle') {
    const f = idleDemoAt(demo, now)
    if (!f) return null

    return encodeCells(cropLeft(placeIdle(f.routine === null ? idleFrame(FALLBACK_ROUTINE, DOZE_MS + f.ms) : idleFrame(f.routine, f.ms, mod.brokenIdle, onBreak)), columns))
  }
  if (demo?.kind === 'waiting') {
    if (!demoStep(demo, now)) return null
    const at = waitingDemoAt(demo.at, now)

    return encodeCells('log' in at ? cropLeft(waitingFrame(at.log, now), columns) : idleAt(at.idleMs))
  }

  // The stage's scene, with its wipe, Fable's walk and the reactions, as a
  // scene demo is drawn: cropped by the scene's camera.
  if (mod.isBandWorking) {
    mod.director = tick(mod.director, now)

    return encodeCells(composeFrame(shot(mod.director, now), now, columns, castOf(mod, log)))
  }
  if (mod.seats.since !== null && !mod.isWaitingBroken) {
    try {
      return encodeCells(cropLeft(waitingFrame(mod.seats, now), columns))
    } catch (error) {
      mod.isWaitingBroken = true
      log(`stage-toons: the waiting toon failed and was replaced by the idle routine: ${String(error)}`)
    }
  }

  return encodeCells(idleAt(now - mod.idleSince))
}
