/**
 * Client-side file text extraction for dispatch attachments.
 * Handles CSV/TXT/MD (direct read), XLSX (xlsx library), PDF (server API).
 */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    return file.text()
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const xlsx = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = xlsx.read(buffer, { type: 'array' })
    return wb.SheetNames.map(sn => {
      const ws = wb.Sheets[sn]
      return `Sheet: ${sn}\n${xlsx.utils.sheet_to_csv(ws)}`
    }).join('\n\n')
  }

  if (name.endsWith('.pdf')) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
    if (res.ok) {
      const data = await res.json() as { text?: string }
      return data.text ?? ''
    }
    return '[PDF content could not be extracted]'
  }

  try { return file.text() } catch { return `[Could not read ${file.name}]` }
}
