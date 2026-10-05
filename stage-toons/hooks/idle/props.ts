// The props the idle Clawd shows off after a step: one for each stage of
// the default track, and a page with a green tick for any other stage (a
// workflow file's own). Each fits beside him in the idle box: at most 9
// pixels wide and 8 tall.

import type { StageId } from '../../types'
import type { Sprite } from '../scene'
import { BROOM, C, CHECKLIST, GIFT, SCROLL, TUBE } from '../scenes/kit'

const MAP: Sprite = {
  palette: { p: C.paper, s: C.paperShade, r: C.red, g: C.green },
  frames: [['ppsppsp', 'rrsppsg', 'pprrssp', 'ppsprrp', 'gpsppsr']],
}
const BULB: Sprite = {
  palette: { y: C.gold, w: C.white, g: C.gray },
  frames: [['.yyy.', 'yywyy', 'yyyyy', '.yyy.', '.ggg.', '..g..']],
}
const STAMPED: Sprite = {
  palette: { w: C.paper, l: C.ink, r: C.red },
  frames: [['wwwww', 'wllww', 'wwwww', 'wrrrw', 'wrrrw', 'wwwww']],
}
const CLIPBOARD: Sprite = {
  palette: { b: C.wood, d: C.darkGray, w: C.paper, g: C.green },
  frames: [['..dd..', 'bbddbb', 'bwwwwb', 'bwwwgb', 'bgwgwb', 'bwgwwb', 'bbbbbb']],
}
const HAMMER: Sprite = {
  palette: { d: C.gray, w: C.wood },
  frames: [['ddddd', 'ddddd', '..w..', '..w..', '..w..', '..w..']],
}
export const GENERIC_PROP: Sprite = {
  palette: { w: C.paper, g: C.green },
  frames: [['wwwwww', 'wwwwgw', 'wwwgww', 'wgwgww', 'wwgwww', 'wwwwww']],
}

// By the default track's stage ids, in its order.
export const PROPS: Record<StageId, Sprite> = {
  roadmap: MAP,
  brainstorm: BULB,
  spec: SCROLL,
  'spec-audit': STAMPED,
  plan: CHECKLIST,
  'plan-audit': CLIPBOARD,
  develop: HAMMER,
  'claude-test': TUBE,
  'user-test': GIFT,
  cleanup: BROOM,
}

export const propOf = (stage: StageId): Sprite => (Object.hasOwn(PROPS, stage) ? PROPS[stage]! : GENERIC_PROP)
