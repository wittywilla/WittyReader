import { inflateSync, strFromU8 } from 'fflate'

// The files in a ZIP (a comic), found from its directory at the end and read
// one at a time from the stored file, so a large comic is never unpacked into
// memory whole. Pictures are nearly always stored as they are, and those are
// read straight from the file without a copy.

export type ZipFile = { name: string; method: number; size: number; packed: number; at: number }

const read = async (blob: Blob, from: number, to: number) => new DataView(await blob.slice(from, to).arrayBuffer())

// The ZIP's files, or null for one this can't read without unpacking it (ZIP64,
// a comic of over 4 GB or 65,535 files), which is then unpacked as before.
export async function zipFiles(blob: Blob): Promise<ZipFile[] | null> {
  const tailAt = Math.max(0, blob.size - 65557) // the end record, after a comment of up to 64 KB
  const tail = await read(blob, tailAt, blob.size)
  let end = -1
  // The end record's signature, where its comment then runs exactly to the end of the file.
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50 && i + 22 + tail.getUint16(i + 20, true) === tail.byteLength) { end = i; break }
  if (end < 0) return null
  const count = tail.getUint16(end + 10, true), size = tail.getUint32(end + 12, true), start = tail.getUint32(end + 16, true)
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff || start + size > blob.size) return null
  const dir = await read(blob, start, start + size)
  const out: ZipFile[] = []
  for (let p = 0; out.length < count; ) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== 0x02014b50) return null
    const flags = dir.getUint16(p + 8, true)
    const nameLen = dir.getUint16(p + 28, true), extraLen = dir.getUint16(p + 30, true), commentLen = dir.getUint16(p + 32, true)
    if (p + 46 + nameLen > dir.byteLength) return null
    const name = strFromU8(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLen), !(flags & 0x800)) // as fflate names them
    const f = { name, method: dir.getUint16(p + 10, true), packed: dir.getUint32(p + 20, true), size: dir.getUint32(p + 24, true), at: dir.getUint32(p + 42, true) }
    if (f.packed === 0xffffffff || f.size === 0xffffffff || f.at === 0xffffffff) return null
    if (flags & 1) f.method = -1 // encrypted: refused when it's read
    out.push(f)
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

// One file's contents, as a Blob of the given type.
export async function zipFile(blob: Blob, f: ZipFile, type = ''): Promise<Blob> {
  const local = await read(blob, f.at, f.at + 30)
  if (local.byteLength < 30 || local.getUint32(0, true) !== 0x04034b50) throw new Error('This comic is damaged.')
  const from = f.at + 30 + local.getUint16(26, true) + local.getUint16(28, true)
  const packed = blob.slice(from, from + f.packed)
  if (f.method === 0) return packed.slice(0, f.packed, type)
  if (f.method === -1) throw new Error('This comic is protected with a password, so it can’t be opened here.')
  if (f.method !== 8) throw new Error('This comic is packed in a way WittyReader can’t read.')
  if (typeof DecompressionStream !== 'undefined') {
    return new Blob([await new Response(packed.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()], { type })
  }
  return new Blob([inflateSync(new Uint8Array(await packed.arrayBuffer())) as BlobPart], { type })
}
