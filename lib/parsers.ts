import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface ParseResult {
  text: string
  displayContent?: string // HTML for word docs; JSON for excel/csv
}

export const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'])

export function getMimeType(fileType: string): string {
  const t = fileType.toLowerCase()
  if (t === 'jpg' || t === 'jpeg') return 'image/jpeg'
  if (t === 'png') return 'image/png'
  if (t === 'webp') return 'image/webp'
  if (t === 'gif') return 'image/gif'
  if (t === 'heic') return 'image/heic'
  return 'application/octet-stream'
}

export async function extractContent(buffer: Buffer, fileType: string): Promise<ParseResult> {
  const ft = fileType.toLowerCase()
  switch (ft) {
    case 'pdf':  return { text: await extractPdf(buffer) }
    case 'docx':
    case 'doc':  return extractWord(buffer)
    case 'xlsx':
    case 'xls':  return extractExcel(buffer)
    case 'csv':  return extractCsv(buffer)
    case 'txt':
    case 'md':   return { text: buffer.toString('utf-8') }
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
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return data.text
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
