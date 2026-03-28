export interface ParsedContact {
  name: string
  title: string
  email: string
  phone: string
  area: string
}

// ── vCard parser ─────────────────────────────────────────────────────────────

function unescapeVCard(val: string): string {
  return val.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseVCardBlock(block: string): ParsedContact | null {
  const lines: string[] = []
  // Unfold lines (continuation lines start with space or tab)
  for (const raw of block.split(/\r?\n/)) {
    if (/^[ \t]/.test(raw) && lines.length > 0) {
      lines[lines.length - 1] += raw.trimStart()
    } else {
      lines.push(raw)
    }
  }

  let name = ''
  let title = ''
  let email = ''
  let phone = ''

  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const prop = line.slice(0, colon).toUpperCase()
    const val = unescapeVCard(line.slice(colon + 1).trim())

    if (prop === 'FN') {
      name = val
    } else if (prop.startsWith('N') && !name) {
      // N:last;first;middle;prefix;suffix
      const parts = val.split(';')
      const last = (parts[0] ?? '').trim()
      const first = (parts[1] ?? '').trim()
      name = [first, last].filter(Boolean).join(' ')
    } else if (prop.startsWith('TITLE')) {
      title = val
    } else if (prop.startsWith('EMAIL') && !email) {
      email = val
    } else if (prop.startsWith('TEL') && !phone) {
      phone = val
    }
  }

  if (!name.trim()) return null
  return { name: name.trim(), title, email, phone, area: '' }
}

export function parseVCard(text: string): ParsedContact[] {
  const blocks = text.split(/BEGIN:VCARD/i).slice(1)
  return blocks
    .map(b => parseVCardBlock(b.split(/END:VCARD/i)[0] ?? b))
    .filter((c): c is ParsedContact => c !== null)
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

export function parseCsv(text: string): ParsedContact[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))

  // Map common header variants to our fields
  const idx = (variants: string[]) => {
    for (const v of variants) {
      const i = headers.findIndex(h => h.includes(v))
      if (i !== -1) return i
    }
    return -1
  }

  const nameIdx   = idx(['name', 'fullname', 'contactname'])
  const firstIdx  = idx(['firstname', 'givenname', 'first'])
  const lastIdx   = idx(['lastname', 'surname', 'familyname', 'last'])
  const titleIdx  = idx(['title', 'jobtitle', 'role', 'position', 'jobrole'])
  const emailIdx  = idx(['email', 'emailaddress', 'email1value', 'emailaddress1'])
  const phoneIdx  = idx(['phone', 'tel', 'mobile', 'phone1value', 'phonenumber', 'mobilephone'])

  return lines.slice(1).map(line => {
    const cols = parseCsvRow(line)
    const get = (i: number) => (i !== -1 ? (cols[i] ?? '').trim() : '')

    let name = get(nameIdx)
    if (!name && (firstIdx !== -1 || lastIdx !== -1)) {
      name = [get(firstIdx), get(lastIdx)].filter(Boolean).join(' ')
    }
    if (!name) return null

    return {
      name,
      title: get(titleIdx),
      email: get(emailIdx),
      phone: get(phoneIdx),
      area: '',
    }
  }).filter((c): c is ParsedContact => c !== null)
}
