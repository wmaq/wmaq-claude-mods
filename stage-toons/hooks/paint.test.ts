import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import { AGENT_POLL_MS, createMod, createSite, type Mod, RESEND_MS, type Site, type SiteKind } from './mod'
import { animate, type Ports } from './paint'

const START = 1_000_000

// Stand-in ports: a clock that moves only when the loop sleeps, blits that
// answer as the test says, and a record of what the loop did.
function fake(mod: Mod, opts: { cells?: (site: Site, now: number) => string | null; deny?: (n: number) => boolean; stopAt?: number } = {}) {
  let now = START
  const blits: { at: number; key: SiteKind; cells: string }[] = []
  const events: string[] = []
  let invalidations = 0
  let polls = 0
  const ports: Ports = {
    now: async () => now,
    sleep: async ms => {
      now += ms
      // The test ends the loop by unmounting its site.
      if (opts.stopAt !== undefined && now >= opts.stopAt) {
        mod.band.requestId = undefined
        for (const site of mod.toons.values()) site.requestId = undefined
      }
    },
    blit: async frame => {
      blits.push({ at: now, key: frame.key, cells: frame.cells })
      events.push('blit')

      return opts.deny?.(blits.length) ? { deny: 'not mounted' } : {}
    },
    invalidate: () => {
      invalidations += 1
    },
    log: () => undefined,
    pollAgents: async () => {
      polls += 1
      events.push('poll')
    },
    cells: opts.cells ?? (() => 'A'),
  }

  return { ports, blits, events, counts: () => ({ invalidations, polls }), now: () => now }
}

// A site mounted under a requestId: the band's area, or a toon kept in the mod.
function mounted(mod: Mod, kind: SiteKind, isSeen: boolean): Site {
  const site = kind === 'area' ? mod.band : createSite('toon')
  site.requestId = 'r1'
  site.isSeen = isSeen
  if (kind === 'toon') mod.toons.set('r1', site)

  return site
}

// The loop runs detached: wait until it has ended.
async function finished(site: Site) {
  for (let i = 0; i < 100_000 && site.isAnimating; i++) await Promise.resolve()
  expect(site.isAnimating).toBe(false)
}

const awake = (mod: Mod) => {
  mod.idleSince = START
}

test('a seen site gives up after 3 refused frames, one not yet seen after 24', async () => {
  for (const [isSeen, expected] of [[true, 3], [false, 24]] as const) {
    const mod = createMod()
    const site = mounted(mod, 'toon', isSeen)
    const { ports, blits } = fake(mod, { deny: () => true })
    animate(ports, mod, site)
    await finished(site)
    expect(blits.length).toBe(expected)
  }
})

test('an unchanged frame is not sent again until RESEND_MS has passed', async () => {
  const mod = createMod()
  const site = mounted(mod, 'toon', true)
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
  const site = mounted(mod, 'toon', true)
  const { ports, blits } = fake(mod, { cells: (_, now) => (now < START + 200 ? 'A' : 'B'), stopAt: START + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.map(b => b.cells)).toEqual(['A', 'B'])
})

test('a refused frame is sent again on the next step: refusal forgets the frame shown', async () => {
  const mod = createMod()
  const site = mounted(mod, 'toon', true)
  const { ports, blits } = fake(mod, { deny: n => n === 1, stopAt: START + 1000 })
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(2)
  expect(blits[1]!.at > START && blits[1]!.at < START + 200).toBe(true)
})

test('the area stops on its still picture once deep asleep, without asking for a redraw', async () => {
  const mod = createMod()
  mod.idleSince = START - DOZE_MS - DEEP_SLEEP_MS
  const site = mounted(mod, 'area', true)
  const { ports, blits, counts } = fake(mod)
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(1)
  expect(site.isAsleep).toBe(true)
  expect(counts().invalidations).toBe(0)
})

test('a band that gave up asks for one redraw and forgets its Raster; a toon does neither', async () => {
  for (const [kind, expected] of [['area', 1], ['toon', 0]] as const) {
    const mod = createMod()
    awake(mod)
    const site = mounted(mod, kind, true)
    const { ports, counts } = fake(mod, { deny: () => true })
    animate(ports, mod, site)
    await finished(site)
    expect(counts().invalidations).toBe(expected)
    // The spinner's own render decides a toon's fate.
    expect(site.requestId).toBe(kind === 'area' ? undefined : 'r1')
  }
})

test('the area polls the agents before its first frame, then every AGENT_POLL_MS while it knows of agents', async () => {
  const mod = createMod()
  awake(mod)
  mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-sonnet-5-5', START)
  const site = mounted(mod, 'area', true)
  const { ports, events, counts } = fake(mod, { stopAt: START + 2 * AGENT_POLL_MS + 500 })
  animate(ports, mod, site)
  await finished(site)
  expect(events.slice(0, 2)).toEqual(['poll', 'blit'])
  expect(counts().polls).toBe(3)
})

test('the area polls only before its first frame while it knows of no agents', async () => {
  const mod = createMod()
  awake(mod)
  const site = mounted(mod, 'area', true)
  const { ports, counts } = fake(mod, { stopAt: START + 2 * AGENT_POLL_MS + 500 })
  animate(ports, mod, site)
  await finished(site)
  expect(counts().polls).toBe(1)
})

test('a toon never polls the agents', async () => {
  const mod = createMod()
  mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-sonnet-5-5', START)
  const site = mounted(mod, 'toon', true)
  const { ports, counts } = fake(mod, { stopAt: START + 2 * AGENT_POLL_MS + 500 })
  animate(ports, mod, site)
  await finished(site)
  expect(counts().polls).toBe(0)
})

test('a demo that is over ends the loop, clears the demo and asks for a redraw', async () => {
  const mod = createMod()
  awake(mod)
  mod.demo = { kind: 'waiting', at: START }
  const site = mounted(mod, 'area', true)
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
  const site = mounted(mod, 'toon', true)
  const { ports, blits } = fake(mod, { stopAt: START + 500 })
  animate(ports, mod, site)
  animate(ports, mod, site)
  await finished(site)
  expect(blits.length).toBe(1)
})
