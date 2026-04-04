import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface ParseResult {
  text: string
  displayContent?: string // HTML for word docs; JSON for excel/csv
}

export const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'])
export const AUDIO_TYPES = new Set(['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac', 'opus'])

export function getMimeType(fileType: string): string {
  const t = fileType.toLowerCase()
  if (t === 'jpg' || t === 'jpeg') return 'image/jpeg'
  if (t === 'png') return 'image/png'
  if (t === 'webp') return 'image/webp'
  if (t === 'gif') return 'image/gif'
  if (t === 'heic') return 'image/heic'
  return 'application/octet-stream'
}

export function getAudioMimeType(fileType: string): string {
  const t = fileType.toLowerCase()
  if (t === 'mp3') return 'audio/mpeg'
  if (t === 'wav') return 'audio/wav'
  if (t === 'm4a') return 'audio/mp4'
  if (t === 'ogg') return 'audio/ogg'
  if (t === 'webm') return 'audio/webm'
  if (t === 'flac') return 'audio/flac'
  if (t === 'aac') return 'audio/aac'
  if (t === 'opus') return 'audio/ogg; codecs=opus'
  return 'audio/mpeg'
}

export async function extractContent(buffer: Buffer, fileType: string): Promise<ParseResult> {
  const ft = fileType.toLowerCase()
  switch (ft) {
    case 'pdf':  return { text: normalizeContent(await extractPdf(buffer)) }
    case 'docx':
    case 'doc': {
      const r = await extractWord(buffer)
      return { ...r, text: normalizeContent(r.text) }
    }
    case 'xlsx':
    case 'xls':  return extractExcel(buffer)
    case 'csv':  return extractCsv(buffer)
    case 'txt':  return { text: normalizeContent(buffer.toString('utf-8')) }
    case 'md':   return { text: buffer.toString('utf-8') }   // keep markdown structure intact
    default:
      // Image types — caller handles description via AI vision
      if (IMAGE_TYPES.has(ft)) return { text: '', displayContent: `image:pending` }
      return { text: buffer.toString('utf-8') }
  }
}

// Keep for backwards compat
export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  return (await extractContent(buffer, fileType)).text
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()
  return result.text
}

async function extractWord(buffer: Buffer): Promise<ParseResult> {
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }, {
      styleMap: [
        'p[style-name="Heading 1"] => h1:fresh',
        'p[style-name="Heading 2"] => h2:fresh',
        'p[style-name="Heading 3"] => h3:fresh',
        'p[style-name="Title"] => h1:fresh',
        'b => strong',
        'i => em',
      ],
    }),
  ])
  return { text: textResult.value, displayContent: htmlResult.value }
}

function extractExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const textLines: string[] = []
  const sheets: Array<{ name: string; rows: string[][] }> = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // For text (AI analysis): CSV format
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    textLines.push(`=== Sheet: ${sheetName} ===`, csv)

    // For display: structured rows
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
    const rows = (aoa as string[][]).filter(r => r.some(c => c !== '' && c != null))
    sheets.push({ name: sheetName, rows: rows.map(r => r.map(c => String(c ?? ''))) })
  }

  return {
    text: textLines.join('\n'),
    displayContent: JSON.stringify({ type: 'excel', sheets }),
  }
}

function extractCsv(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8')
  const result = Papa.parse(text, { header: false, skipEmptyLines: true })
  const rows = result.data as string[][]

  // Text for AI: pipe-separated
  const textLines = rows.map(r => r.join(' | '))
  const textOutput = textLines.join('\n')

  return {
    text: textOutput,
    displayContent: JSON.stringify({ type: 'csv', rows }),
  }
}

export function normalizeContent(raw: string): string {
  // Detect repeated lines (page headers/footers that appear ≥4 times)
  const lineCounts = new Map<string, number>()
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (t.length >= 15 && t.length <= 120) {
      lineCounts.set(t, (lineCounts.get(t) ?? 0) + 1)
    }
  }
  const boilerplate = new Set(
    [...lineCounts.entries()].filter(([, n]) => n >= 4).map(([l]) => l)
  )

  const out: string[] = []
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim()
    if (!line) { out.push(''); continue }
    if (boilerplate.has(line)) continue
    // Decorative separators: ---, ===, ***, ~~~, •••, etc.
    if (/^[\-=_*~•]{3,}$/.test(line)) continue
    // Bare page numbers
    if (/^\d{1,4}$/.test(line)) continue
    // "Page N" / "Page N of M"
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) continue
    // Lines made of a single repeated character (e.g. "........", "________")
    if (line.length > 3 && new Set(line.replace(/\s/g, '')).size === 1) continue
    out.push(line)
  }

  return out.join('\n')
    .replace(/[ \t]{2,}/g, ' ')    // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')    // max one blank line between paragraphs
    .trim()
}

export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ext
}

export function getMimeTypes(): Record<string, string> {
  return {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'text/markdown': 'md',
  }
}
