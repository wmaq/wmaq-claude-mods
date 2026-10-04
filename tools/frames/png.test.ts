import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inflateSync } from 'node:zlib'

import { crc32, encodePng } from './png'

// The chunks of a PNG: type, data, and whether its CRC is right.
function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const out: { type: string; data: Uint8Array; isCrcRight: boolean }[] = []
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const data = png.subarray(at + 8, at + 8 + length)
    out.push({ type, data, isCrcRight: view.getUint32(at + 8 + length) === crc32(png.subarray(at + 4, at + 8 + length)) })
    at += 12 + length
  }

  return out
}

test('a PNG has the signature, an RGBA header, and right CRCs', () => {
  const png = encodePng(2, 1, Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]))
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = chunks(png)
  assert.deepEqual(
    parts.map(p => p.type),
    ['IHDR', 'IDAT', 'IEND'],
  )
  assert.ok(parts.every(p => p.isCrcRight))
  const header = new DataView(parts[0]!.data.buffer, parts[0]!.data.byteOffset)
  assert.equal(header.getUint32(0), 2)
  assert.equal(header.getUint32(4), 1)
  assert.deepEqual([...parts[0]!.data.subarray(8)], [8, 6, 0, 0, 0])
})

test("a PNG's data inflates back to its rows, each with filter 0", () => {
  const rgba = Uint8Array.from({ length: 2 * 3 * 4 }, (_, i) => (i * 37) % 256)
  const idat = chunks(encodePng(2, 3, rgba)).find(p => p.type === 'IDAT')!
  const raw = inflateSync(idat.data)
  assert.equal(raw.length, 3 * (1 + 2 * 4))
  for (let y = 0; y < 3; y++) {
    assert.equal(raw[y * 9], 0)
    assert.deepEqual([...raw.subarray(y * 9 + 1, y * 9 + 9)], [...rgba.subarray(y * 8, y * 8 + 8)])
  }
})

test('the wrong number of bytes is an error', () => {
  assert.throws(() => encodePng(2, 2, new Uint8Array(4)), /4 bytes for 2x2/)
})
