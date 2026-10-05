import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import { AGENT_POLL_MS, createMod, type Mod, RESEND_MS, type Site } from './mod'
import { animate, type Ports } from './paint'

const START = 1_000_000

// Stand-in ports: a clock that moves only when the loop sleeps, blits that
// answer as the test says, and a record of what the loop did.
// currentUntil: when a newer load of the module takes over.
function fake(mod: Mod, opts: { cells?: (site: Site, now: number) => string | null; deny?: (n: number) => boolean; stopAt?: number; currentUntil?: number } = {}) {
  let now = START
  const blits: { at: number; key: string; cells: string }[] = []
  const events: string[] = []
  let invalidations = 0
  let polls = 0
  const ports: Ports = {
    now: async () => now,
    sleep: async ms => {
      now += ms
      // The test ends the loop by unmounting its site.
      if (opts.stopAt !== undefined && now >= opts.stopAt) mod.band.requestId = undefined
    },
    blit: async frame => {
      blits.push({ at: now, key: frame.key, cells: frame.cells })
      events.push('blit')

      return opts.deny?.(blits.length) ? { deny: 'not mounted' } : {}
    },
    invalidate: () => {
      invalidations += 1
    },
    pollAgents: async () => {
      polls += 1
      events.push('poll')
    },
    isCurrent: async () => opts.currentUntil === undefined || now < opts.currentUntil,
    cells: opts.cells ?? (() => 'A'),
  }

  return { ports, blits, events, counts: () => ({ invalidations, polls }), now: () => now }
}

// The band's area, mounted under a requestId.
function mounted(mod: Mod, isSeen: boolean): Site {
  const site = mod.band
  site.requestId = 'r1'
  site.isSeen = isSeen

  return site
}

// Lets the detached loop run until it waits on something.
async function settled() {
  for (let i = 0; i < 1000; i++) await Promise.resolve()
}

// The loop runs detached: wait until it has ended.
async function finished(site: Site) {
  for (let i = 0; i < 100_000 && site.isAnimating; i++) await Promise.resolve()
  expect(site.isAnimating).toBe(false)
}

const awake = (mod: Mod) => {
  mod.idleSince = START
}

// Claude works: the area repaints its scene about twelve times a second.
const working = (mod: Mod) => {
  awake(mod)
  mod.isBandWorking = true
}

test('a seen site gives up after 3 refused frames, one not yet seen after 24', async () => {
  for (const [isSeen, expected] of [[true, 3], [false, 24]] as const) {
    const mod = createMod()
    working(mod)
    const site = mounted(mod, isSeen)
    const { ports, blits } = fake(mod, { deny: () => true })
    animate(ports, mod, site)
    await finished(site)
    expect(blits.length).toBe(expected)
  }
})

test('an unchanged frame is not sent again until RESEND_MS has passed', async () => {
  const mod = createMod()
  working(mod)
  const site = mounted(mod, true)
  const { ports, blits } = fake(mod, { stopAt: START + RESEND_MS + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(2)
  expect(blits[0]!.at).toBe(START)
  expect(blits[1]!.at - START >= RESEND_MS).toBe(true)
  expect(blits[1]!.at - START < RESEND_MS + 100).toBe(true)
})

test('a changed frame is sent at once', async () => {
  const mod = createMod()
  working(mod)
  const site = mounted(mod, true)
  const { ports, blits } = fake(mod, { cells: (_, now) => (now < START + 200 ? 'A' : 'B'), stopAt: START + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.map(b => b.cells)).toEqual(['A', 'B'])
})

test('a refused frame is sent again on the next step: refusal forgets the frame shown', async () => {
  const mod = createMod()
  working(mod)
  const site = mounted(mod, true)
  const { ports, blits } = fake(mod, { deny: n => n === 1, stopAt: START + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(2)
  expect(blits[1]!.at > START && blits[1]!.at < START + 200).toBe(true)
})

test('the area stops on its still picture once deep asleep, without asking for a redraw', async () => {
  const mod = createMod()
  mod.idleSince = START - DOZE_MS - DEEP_SLEEP_MS
  const site = mounted(mod, true)
  const { ports, blits, counts } = fake(mod)
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(1)
  expect(site.isAsleep).toBe(true)
  expect(counts().invalidations).toBe(0)
})

test('a band that gave up asks for one redraw and forgets its Raster', async () => {
  const mod = createMod()
  awake(mod)
  const site = mounted(mod, true)
  const { ports, counts } = fake(mod, { deny: () => true })
  animate(ports, mod, site)
  await finished(site)
  expect(counts().invalidations).toBe(1)
  expect(site.requestId).toBe(undefined)
})

test('while Claude works the area repaints about twelve times a second, and never falls deep asleep', async () => {
  const mod = createMod()
  // The last turn ended long ago: a long turn must not count as dozing.
  mod.idleSince = START - DOZE_MS - DEEP_SLEEP_MS - 60_000
  mod.isBandWorking = true
  const site = mounted(mod, true)
  const { ports, blits } = fake(mod, { cells: (_, now) => String(now), stopAt: START + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(13)
  expect(site.isAsleep).toBe(false)
})

test('the area polls the agents before its first frame, then every AGENT_POLL_MS while it knows of agents', async () => {
  const mod = createMod()
  awake(mod)
  mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-sonnet-5-5', START)
  const site = mounted(mod, true)
  const { ports, events, counts } = fake(mod, { stopAt: START + 2 * AGENT_POLL_MS + 500 })
  animate(ports, mod, site)
  await finished(site)
  expect(events.slice(0, 2)).toEqual(['poll', 'blit'])
  expect(counts().polls).toBe(3)
})

test('the area polls only before its first frame while it knows of no agents', async () => {
  const mod = createMod()
  awake(mod)
  const site = mounted(mod, true)
  const { ports, counts } = fake(mod, { stopAt: START + 2 * AGENT_POLL_MS + 500 })
  animate(ports, mod, site)
  await finished(site)
  expect(counts().polls).toBe(1)
})

test('a demo that is over ends the loop, clears the demo and asks for a redraw', async () => {
  const mod = createMod()
  awake(mod)
  mod.demo = { kind: 'waiting', at: START }
  const site = mounted(mod, true)
  const { ports, blits, counts } = fake(mod, { cells: () => null })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(0)
  expect(mod.demo).toBe(null)
  expect(site.requestId).toBe(undefined)
  expect(counts().invalidations).toBe(1)
})

test('a second start while the loop runs is ignored', async () => {
  const mod = createMod()
  working(mod)
  const site = mounted(mod, true)
  const { ports, blits } = fake(mod, { stopAt: START + 500 })
  animate(ports, mod, site)
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(1)
})

test('a start while the loop sleeps wakes it: the next frame comes at once, on the same loop', async () => {
  const mod = createMod()
  // Idle, awake: a 166 ms sleep between frames.
  mod.idleSince = START
  const site = mounted(mod, true)
  let frames = 0
  let wakeUp: () => void = () => undefined
  const { ports, blits } = fake(mod, { cells: () => `F${frames++}` })
  // A sleep that lasts until the test ends it.
  ports.sleep = () => new Promise<void>(resolve => (wakeUp = resolve))
  animate(ports, mod, site)
  await settled()
  expect(blits.length).toBe(1)
  animate(ports, mod, site)
  await settled()
  expect(blits.map(b => b.cells)).toEqual(['F0', 'F1'])
  expect(site.isAnimating).toBe(true)
  site.requestId = undefined
  wakeUp()
  await finished(site)
  expect(blits.length).toBe(2)
  expect(site.wake).toBeNull()
})

test('a loop whose load a newer one replaced stops at its next frame, quietly: no redraw, the Raster left to the new load', async () => {
  const mod = createMod()
  working(mod)
  const site = mounted(mod, true)
  // stopAt bounds the loop should it never stop by itself.
  const { ports, blits, counts } = fake(mod, { cells: (_, now) => String(now), currentUntil: START + 500, stopAt: START + 2000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(7)
  expect(blits.every(b => b.at < START + 500)).toBe(true)
  expect(counts().invalidations).toBe(0)
  expect(site.requestId).toBe('r1')
})
