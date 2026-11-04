// src/zip.ts against ZIPs made by fflate: what it lists and what it reads back.
//   npm test
import assert from 'node:assert'
import { test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { zipFile, zipFiles } from '../../src/zip.ts'

const page = (n) => Uint8Array.from({ length: 5000 }, (_, i) => (i * n) % 251)
const files = {
  'b/2.jpg': [page(2), { level: 0 }], // stored, as comics' pictures nearly always are
  'b/10.jpg': [page(10), { level: 6 }], // packed
  'ComicInfo.xml': strToU8('<ComicInfo><Series>Ünïcode</Series></ComicInfo>'),
  '名前.png': [page(3), { level: 0 }],
}

test('lists every file with its name, and reads each back as it was', async () => {
  const blob = new Blob([zipSync(files, { comment: 'a comment at the end' })])
  const list = await zipFiles(blob)
  assert.deepStrictEqual(list.map((f) => f.name).sort(), Object.keys(files).sort())
  for (const f of list) {
    const want = Array.isArray(files[f.name]) ? files[f.name][0] : files[f.name]
    const got = new Uint8Array(await (await zipFile(blob, f, 'image/jpeg')).arrayBuffer())
    assert.deepStrictEqual(got, want, f.name)
  }
  assert.deepStrictEqual(list.map((f) => f.method).sort(), [0, 0, 8, 8])
})

test('a stored file comes back with the type asked for', async () => {
  const blob = new Blob([zipSync({ 'a.png': [page(1), { level: 0 }] })])
  const [f] = await zipFiles(blob)
  assert.strictEqual((await zipFile(blob, f, 'image/png')).type, 'image/png')
})

test('anything that is not a ZIP gives null, to be unpacked the old way', async () => {
  assert.strictEqual(await zipFiles(new Blob(['%PDF-1.7 not a zip'])), null)
  assert.strictEqual(await zipFiles(new Blob([])), null)
})

test('an encrypted file is refused when read', async () => {
  const z = zipSync({ 'a.jpg': [page(1), { level: 0 }] })
  const dv = new DataView(z.buffer)
  for (let i = 0; i < z.length - 4; i++) if (dv.getUint32(i, true) === 0x02014b50) dv.setUint16(i + 8, dv.getUint16(i + 8, true) | 1, true)
  const blob = new Blob([z])
  const [f] = await zipFiles(blob)
  await assert.rejects(zipFile(blob, f))
})
