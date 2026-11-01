#!/usr/bin/env node
// Writes three tiny books with made-up contents: one EPUB, one PDF and one CBZ.
//
//   node make-books.mjs <folder>
import { deflateRawSync, crc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
mkdirSync(out, { recursive: true })

// A zip with its files stored as they are, or deflated when it's asked for.
function zip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content, deflate] of entries) {
    const data = Buffer.from(content)
    const body = deflate ? deflateRawSync(data) : data
    const nameBytes = Buffer.from(name)
    const common = Buffer.alloc(26)
    common.writeUInt16LE(20, 0) // version needed
    common.writeUInt16LE(0, 2) // flags
    common.writeUInt16LE(deflate ? 8 : 0, 4) // method
    common.writeUInt32LE(0x00210000, 6) // a time and date
    common.writeUInt32LE(crc32(data), 10)
    common.writeUInt32LE(body.length, 14)
    common.writeUInt32LE(data.length, 18)
    common.writeUInt16LE(nameBytes.length, 22)
    const local = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), common, nameBytes, body])
    const central = Buffer.concat([
      Buffer.from('PK\x01\x02', 'latin1'), Buffer.from([20, 0]), common, Buffer.alloc(10),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(offset); return b })(), nameBytes,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const dir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.write('PK\x05\x06', 0, 'latin1')
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, dir, end])
}

const epub = zip([
  ['mimetype', 'application/epub+zip'],
  ['META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`, true],
  ['book.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">made-up-1</dc:identifier><dc:title>A Made-Up Book</dc:title><dc:creator>A Made-Up Author</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="c1"/></spine></package>`, true],
  ['nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">One</a></li></ol></nav></body></html>`, true],
  ['one.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>One</h1><p>This chapter was written for a test and says nothing else.</p></body></html>`, true],
])
writeFileSync(join(out, 'A Made-Up Book.epub'), epub)

// The smallest PDF with one page and one line.
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  null,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Title (A Made-Up Paper) /Author (A Made-Up Author) >>',
]
const text = 'BT /F1 18 Tf 20 100 Td (A made-up paper) Tj ET'
objects[3] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`
let pdf = '%PDF-1.4\n'
const xref = []
objects.forEach((body, i) => { xref.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n` })
const start = pdf.length
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${start}\n%%EOF\n`
writeFileSync(join(out, 'A Made-Up Paper.pdf'), pdf)

// A one-pixel PNG, three times, as a comic.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==', 'base64')
writeFileSync(join(out, 'A Made-Up Comic.cbz'), zip([['001.png', pixel], ['002.png', pixel], ['003.png', pixel]]))
