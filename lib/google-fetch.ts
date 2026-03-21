export interface GoogleFetchResult {
  buffer: Buffer
  fileType: string
  fileName: string
}

function extractGoogleId(url: string): { type: 'sheets' | 'docs'; id: string } | null {
  const sheets = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (sheets) return { type: 'sheets', id: sheets[1] }

  const docs = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/)
  if (docs) return { type: 'docs', id: docs[1] }

  return null
}

export function isGoogleUrl(url: string): boolean {
  return extractGoogleId(url) !== null
}

export async function fetchGoogleContent(url: string): Promise<GoogleFetchResult> {
  const parsed = extractGoogleId(url)
  if (!parsed) throw new Error('Not a Google Sheets or Docs URL')

  if (parsed.type === 'sheets') {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv`
    const res = await fetch(exportUrl, { redirect: 'follow' })
    if (!res.ok) {
      throw new Error(
        res.status === 403 || res.status === 401
          ? 'Sheet is private. Share it with "Anyone with the link" first.'
          : `Could not fetch sheet (${res.status})`
      )
    }
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      fileType: 'csv',
      fileName: 'report.csv',
    }
  }

  // Google Doc → plain text
  const exportUrl = `https://docs.google.com/document/d/${parsed.id}/export?format=txt`
  const res = await fetch(exportUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 401
        ? 'Document is private. Share it with "Anyone with the link" first.'
        : `Could not fetch document (${res.status})`
    )
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    fileType: 'txt',
    fileName: 'report.txt',
  }
}
