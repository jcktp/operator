import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return extractPdf(buffer)
    case 'docx':
    case 'doc':
      return extractWord(buffer)
    case 'xlsx':
    case 'xls':
      return extractExcel(buffer)
    case 'csv':
      return extractCsv(buffer)
    case 'txt':
    case 'md':
      return buffer.toString('utf-8')
    default:
      return buffer.toString('utf-8')
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return data.text
}

async function extractWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function extractExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    lines.push(`=== Sheet: ${sheetName} ===`)
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    lines.push(csv)
  }

  return lines.join('\n')
}

function extractCsv(buffer: Buffer): string {
  const text = buffer.toString('utf-8')
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })

  if (!result.data || result.data.length === 0) return text

  const rows = result.data as Record<string, unknown>[]
  const headers = Object.keys(rows[0])
  const lines = [headers.join(' | ')]

  for (const row of rows) {
    lines.push(headers.map(h => String(row[h] ?? '')).join(' | '))
  }

  return lines.join('\n')
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
