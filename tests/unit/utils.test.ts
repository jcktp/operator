import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatRelativeDate,
  formatFileSize,
  parseJsonSafe,
  parseMetrics,
  extractJsonFromText,
  getAreaColor,
  type Metric,
} from '@/lib/utils'

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a Date object to a readable string', () => {
    const d = new Date('2025-06-15T00:00:00Z')
    const result = formatDate(d)
    expect(result).toContain('2025')
    expect(result).toContain('Jun')
    expect(result).toContain('15')
  })

  it('accepts an ISO string', () => {
    const result = formatDate('2025-01-01T00:00:00Z')
    expect(result).toContain('2025')
  })

  it('returns a non-empty string for any valid date', () => {
    expect(formatDate(new Date())).toBeTruthy()
  })
})

// ── formatRelativeDate ────────────────────────────────────────────────────────

describe('formatRelativeDate', () => {
  const now = new Date()

  it('returns "Today" for a date from today', () => {
    expect(formatRelativeDate(now)).toBe('Today')
  })

  it('returns "Yesterday" for a date from yesterday', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(formatRelativeDate(yesterday)).toBe('Yesterday')
  })

  it('returns "Nd ago" for dates within the past week', () => {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeDate(threeDaysAgo)).toBe('3d ago')
  })

  it('returns "Nw ago" for dates within the past month', () => {
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    expect(formatRelativeDate(twoWeeksAgo)).toBe('2w ago')
  })

  it('returns a formatted date string for dates older than a month', () => {
    const twoMonthsAgo = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000)
    const result = formatRelativeDate(twoMonthsAgo)
    // Should look like a real date, not a relative label
    expect(result).not.toMatch(/ago|Today|Yesterday/)
    expect(result.length).toBeGreaterThan(4)
  })
})

// ── formatFileSize ────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes less than 1024 as "N B"', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1)).toBe('1 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

// ── parseJsonSafe ─────────────────────────────────────────────────────────────

describe('parseJsonSafe', () => {
  it('parses valid JSON', () => {
    expect(parseJsonSafe<number[]>('[1,2,3]', [])).toEqual([1, 2, 3])
    expect(parseJsonSafe<{ a: number }>('{\"a\":1}', { a: 0 })).toEqual({ a: 1 })
  })

  it('returns fallback for invalid JSON', () => {
    expect(parseJsonSafe<number[]>('not json', [])).toEqual([])
    expect(parseJsonSafe<string>('{broken', 'default')).toBe('default')
  })

  it('returns fallback for null or undefined input', () => {
    expect(parseJsonSafe<string[]>(null, [])).toEqual([])
    expect(parseJsonSafe<string[]>(undefined, [])).toEqual([])
  })

  it('returns fallback for empty string', () => {
    expect(parseJsonSafe<string>('', 'fallback')).toBe('fallback')
  })
})

// ── parseMetrics ──────────────────────────────────────────────────────────────

describe('parseMetrics', () => {
  it('parses a valid metrics array', () => {
    const input = JSON.stringify([
      { label: 'Revenue', value: '$1.2M', context: 'Q1', trend: 'up', status: 'positive' },
    ])
    const result = parseMetrics(input)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Revenue')
    expect(result[0].value).toBe('$1.2M')
    expect(result[0].trend).toBe('up')
  })

  it('accepts "name" as a fallback for "label"', () => {
    const input = JSON.stringify([{ name: 'Headcount', value: '120' }])
    const result = parseMetrics(input)
    expect(result[0].label).toBe('Headcount')
  })

  it('drops entries with missing label or value', () => {
    const input = JSON.stringify([
      { label: 'Good', value: '10' },
      { value: '5' },           // missing label
      { label: 'Bad' },         // missing value
      { label: '', value: '1' }, // empty label
    ])
    const result = parseMetrics(input)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Good')
  })

  it('drops entries where label or value is not a string', () => {
    const input = JSON.stringify([
      { label: 42, value: '100' },
      { label: 'Valid', value: 99 },
    ])
    expect(parseMetrics(input)).toHaveLength(0)
  })

  it('returns empty array for null or undefined input', () => {
    expect(parseMetrics(null)).toEqual([])
    expect(parseMetrics(undefined)).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseMetrics('not json')).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    expect(parseMetrics('{\"label\": \"x\"}')).toEqual([])
  })

  it('omits optional fields when not present', () => {
    const input = JSON.stringify([{ label: 'NPS', value: '72' }])
    const result = parseMetrics(input)
    expect(result[0]).not.toHaveProperty('context')
    expect(result[0]).not.toHaveProperty('trend')
    expect(result[0]).not.toHaveProperty('status')
  })
})

// ── extractJsonFromText ───────────────────────────────────────────────────────

describe('extractJsonFromText', () => {
  it('extracts JSON from a fenced code block', () => {
    const text = '```json\n{"key":"value"}\n```'
    expect(extractJsonFromText(text)).toBe('{"key":"value"}')
  })

  it('extracts JSON from an unfenced code block', () => {
    const text = '```\n{"key":"value"}\n```'
    expect(extractJsonFromText(text)).toBe('{"key":"value"}')
  })

  it('extracts a bare JSON object from surrounding text', () => {
    const text = 'Here is the result:\n{"score": 9}\nEnd.'
    expect(JSON.parse(extractJsonFromText(text))).toEqual({ score: 9 })
  })

  it('extracts a bare JSON array from surrounding text', () => {
    const text = 'Results: [1, 2, 3]'
    expect(JSON.parse(extractJsonFromText(text))).toEqual([1, 2, 3])
  })

  it('throws for text with no valid JSON', () => {
    expect(() => extractJsonFromText('no json here')).toThrow()
  })

  it('throws for empty string', () => {
    expect(() => extractJsonFromText('')).toThrow()
  })

  it('extracts complex nested objects', () => {
    const obj = { metrics: [{ label: 'x', value: '1' }], summary: 'ok' }
    const text = `Prefix\n${JSON.stringify(obj)}\nSuffix`
    const result = JSON.parse(extractJsonFromText(text))
    expect(result).toEqual(obj)
  })
})

// ── getAreaColor ──────────────────────────────────────────────────────────────

describe('getAreaColor', () => {
  it('returns a Tailwind class string for known areas', () => {
    const color = getAreaColor('Finance')
    expect(typeof color).toBe('string')
    expect(color.length).toBeGreaterThan(0)
    expect(color).toContain('bg-')
  })

  it('returns a consistent color for the same known area', () => {
    expect(getAreaColor('Engineering')).toBe(getAreaColor('Engineering'))
  })

  it('returns a color for unknown areas (hash palette fallback)', () => {
    const color = getAreaColor('UnknownCustomArea')
    expect(typeof color).toBe('string')
    expect(color).toContain('bg-')
  })

  it('returns a deterministic color for unknown areas', () => {
    expect(getAreaColor('MyCustomBeat')).toBe(getAreaColor('MyCustomBeat'))
  })

  it('returns different colors for different unknown areas', () => {
    // Not guaranteed but highly likely given 12-color palette
    const colors = new Set(
      ['AlphaArea', 'BetaArea', 'GammaArea', 'DeltaArea'].map(getAreaColor)
    )
    expect(colors.size).toBeGreaterThan(1)
  })
})
