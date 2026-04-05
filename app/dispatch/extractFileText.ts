/**
 * Client-side file text extraction for dispatch attachments.
 * Handles CSV/TXT/MD (direct read), XLSX/PDF (server-side API).
 */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    return file.text()
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.pdf')) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
    if (res.ok) {
      const data = await res.json() as { text?: string }
      return data.text ?? ''
    }
    return `[Could not extract content from ${file.name}]`
  }

  try { return file.text() } catch { return `[Could not read ${file.name}]` }
}
