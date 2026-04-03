/**
 * Layer 1 file scanning — zero dependencies, pure Node.js buffer checks.
 * Runs on every upload before any file is saved or processed.
 */

export interface ScanResult {
  safe: boolean
  reason?: string
}

// Dangerous executable magic bytes
const DANGEROUS_MAGIC: Array<{ bytes: number[]; label: string }> = [
  { bytes: [0x7F, 0x45, 0x4C, 0x46], label: 'ELF executable' },           // Linux ELF
  { bytes: [0x4D, 0x5A], label: 'Windows executable' },                     // PE / .exe / .dll
  { bytes: [0xCF, 0xFA, 0xED, 0xFE], label: 'Mach-O executable' },         // macOS 64-bit LE
  { bytes: [0xCE, 0xFA, 0xED, 0xFE], label: 'Mach-O executable' },         // macOS 32-bit LE
  { bytes: [0xFE, 0xED, 0xFA, 0xCF], label: 'Mach-O executable' },         // macOS 64-bit BE
  { bytes: [0xFE, 0xED, 0xFA, 0xCE], label: 'Mach-O executable' },         // macOS 32-bit BE
  { bytes: [0xCA, 0xFE, 0xBA, 0xBE], label: 'Mach-O fat binary' },         // Universal binary
]

// Max uncompressed size across all entries in a ZIP: 500 MB
const ZIP_MAX_UNCOMPRESSED = 500 * 1024 * 1024
// Reject if any single entry has compression ratio > 100:1
const ZIP_MAX_RATIO = 100

function checkMagicBytes(buf: Buffer): string | null {
  // Shell scripts: #!
  if (buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21) {
    return 'File appears to be a shell script'
  }
  for (const { bytes, label } of DANGEROUS_MAGIC) {
    if (buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b)) {
      return `File appears to be a ${label}`
    }
  }
  return null
}

function checkZipBomb(buf: Buffer): string | null {
  // ZIP magic: PK\x03\x04
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4B || buf[2] !== 0x03 || buf[3] !== 0x04) return null

  let offset = 0
  let totalUncompressed = 0
  let fileCount = 0

  while (offset + 30 <= buf.length) {
    // Local file header signature
    if (buf[offset] !== 0x50 || buf[offset+1] !== 0x4B || buf[offset+2] !== 0x03 || buf[offset+3] !== 0x04) break

    const compressedSize   = buf.readUInt32LE(offset + 18)
    const uncompressedSize = buf.readUInt32LE(offset + 22)
    const fileNameLen      = buf.readUInt16LE(offset + 26)
    const extraLen         = buf.readUInt16LE(offset + 28)

    totalUncompressed += uncompressedSize

    if (totalUncompressed > ZIP_MAX_UNCOMPRESSED) {
      return `ZIP exceeds maximum allowed uncompressed size (${Math.round(ZIP_MAX_UNCOMPRESSED / 1024 / 1024)} MB)`
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > ZIP_MAX_RATIO) {
      return `ZIP entry has suspicious compression ratio (${Math.round(uncompressedSize / compressedSize)}:1)`
    }

    offset += 30 + fileNameLen + extraLen + compressedSize
    if (++fileCount > 10_000) break // guard against malformed ZIP
  }

  return null
}

function checkOfficeMacros(buf: Buffer): string | null {
  // Old Office CFB format: D0 CF 11 E0 — look for VBA stream marker
  if (buf.length >= 4 && buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) {
    if (buf.indexOf(Buffer.from('VBA')) !== -1) {
      return 'Office file contains VBA macros'
    }
  }

  // New Office OOXML (ZIP-based .docm / .xlsm / .pptm): look for vbaProject.bin entry
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B) {
    if (buf.indexOf(Buffer.from('vbaProject.bin')) !== -1) {
      return 'Office file contains VBA macros (vbaProject.bin detected)'
    }
  }

  return null
}

function checkPdfJavaScript(buf: Buffer, fileName: string): string | null {
  if (!fileName.toLowerCase().endsWith('.pdf')) return null
  // Verify PDF magic: %PDF
  if (buf.length < 4 || buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) return null

  if (buf.indexOf(Buffer.from('/JavaScript')) !== -1 || buf.indexOf(Buffer.from('/JS ')) !== -1) {
    return 'PDF contains embedded JavaScript'
  }

  return null
}

export function scanFile(buf: Buffer, fileName: string): ScanResult {
  const magic = checkMagicBytes(buf)
  if (magic) return { safe: false, reason: magic }

  const zipBomb = checkZipBomb(buf)
  if (zipBomb) return { safe: false, reason: zipBomb }

  const macros = checkOfficeMacros(buf)
  if (macros) return { safe: false, reason: macros }

  const pdfJs = checkPdfJavaScript(buf, fileName)
  if (pdfJs) return { safe: false, reason: pdfJs }

  return { safe: true }
}
