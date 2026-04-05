import { describe, it, expect } from 'vitest'
import {
  normalizeContent,
  getMimeType,
  getAudioMimeType,
  getFileType,
  IMAGE_TYPES,
  AUDIO_TYPES,
} from '@/lib/parsers'

// ── normalizeContent ──────────────────────────────────────────────────────────

describe('normalizeContent', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeContent('  hello  ')).toBe('hello')
  })

  it('collapses runs of 3+ blank lines to a single blank line', () => {
    const input = 'first\n\n\n\nsecond'
    const result = normalizeContent(input)
    expect(result).toBe('first\n\nsecond')
  })

  it('collapses horizontal whitespace runs to a single space', () => {
    expect(normalizeContent('word    another')).toBe('word another')
  })

  it('removes decorative separator lines (---)', () => {
    const input = 'intro\n---\nbody'
    expect(normalizeContent(input)).toBe('intro\nbody')
  })

  it('removes decorative separator lines (===)', () => {
    const input = 'intro\n===\nbody'
    expect(normalizeContent(input)).toBe('intro\nbody')
  })

  it('removes decorative separator lines (***)', () => {
    const input = 'intro\n***\nbody'
    expect(normalizeContent(input)).toBe('intro\nbody')
  })

  it('removes bare page numbers', () => {
    const lines = ['paragraph text', '42', 'next paragraph']
    expect(normalizeContent(lines.join('\n'))).toBe('paragraph text\nnext paragraph')
  })

  it('removes "Page N" lines (case insensitive)', () => {
    const input = 'body\nPage 5\nmore body'
    expect(normalizeContent(input)).toBe('body\nmore body')
  })

  it('removes "Page N of M" lines', () => {
    const input = 'body\nPage 1 of 10\nmore body'
    expect(normalizeContent(input)).toBe('body\nmore body')
  })

  it('removes lines made of a single repeated character', () => {
    const input = 'title\n________\ncontent'
    expect(normalizeContent(input)).toBe('title\ncontent')
  })

  it('removes boilerplate lines that appear 4 or more times', () => {
    // A header/footer that repeats ≥4 times across pages
    const repeated = 'Confidential — Acme Corp 2025'
    const lines = [
      'First page content',
      repeated,
      'Second page content',
      repeated,
      'Third page content',
      repeated,
      'Fourth page content',
      repeated,
    ]
    const result = normalizeContent(lines.join('\n'))
    expect(result).not.toContain(repeated)
    expect(result).toContain('First page content')
  })

  it('preserves lines that appear fewer than 4 times', () => {
    const lines = ['intro', 'Repeated line', 'body', 'Repeated line', 'footer']
    const result = normalizeContent(lines.join('\n'))
    expect(result).toContain('Repeated line')
  })

  it('preserves short repeated lines (< 15 chars) — not treated as boilerplate', () => {
    const lines = ['x', 'x', 'x', 'x', 'actual content']
    const result = normalizeContent(lines.join('\n'))
    expect(result).toContain('actual content')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeContent('')).toBe('')
    expect(normalizeContent('   \n\n   ')).toBe('')
  })

  it('preserves meaningful content unchanged', () => {
    const input = 'This is a normal paragraph.\n\nThis is another paragraph.'
    expect(normalizeContent(input)).toBe(input)
  })
})

// ── getMimeType ───────────────────────────────────────────────────────────────

describe('getMimeType', () => {
  it('returns image/jpeg for jpg and jpeg', () => {
    expect(getMimeType('jpg')).toBe('image/jpeg')
    expect(getMimeType('jpeg')).toBe('image/jpeg')
    expect(getMimeType('JPG')).toBe('image/jpeg')
  })

  it('returns image/png for png', () => {
    expect(getMimeType('png')).toBe('image/png')
  })

  it('returns image/webp for webp', () => {
    expect(getMimeType('webp')).toBe('image/webp')
  })

  it('returns image/gif for gif', () => {
    expect(getMimeType('gif')).toBe('image/gif')
  })

  it('returns image/heic for heic', () => {
    expect(getMimeType('heic')).toBe('image/heic')
  })

  it('returns application/octet-stream for unknown types', () => {
    expect(getMimeType('xyz')).toBe('application/octet-stream')
    expect(getMimeType('')).toBe('application/octet-stream')
  })
})

// ── getAudioMimeType ──────────────────────────────────────────────────────────

describe('getAudioMimeType', () => {
  it('returns correct MIME for mp3', () => expect(getAudioMimeType('mp3')).toBe('audio/mpeg'))
  it('returns correct MIME for wav', () => expect(getAudioMimeType('wav')).toBe('audio/wav'))
  it('returns correct MIME for m4a', () => expect(getAudioMimeType('m4a')).toBe('audio/mp4'))
  it('returns correct MIME for ogg', () => expect(getAudioMimeType('ogg')).toBe('audio/ogg'))
  it('returns correct MIME for webm', () => expect(getAudioMimeType('webm')).toBe('audio/webm'))
  it('returns correct MIME for flac', () => expect(getAudioMimeType('flac')).toBe('audio/flac'))
  it('returns correct MIME for aac', () => expect(getAudioMimeType('aac')).toBe('audio/aac'))
  it('returns ogg+opus codec for opus', () => {
    expect(getAudioMimeType('opus')).toBe('audio/ogg; codecs=opus')
  })
  it('falls back to audio/mpeg for unknown types', () => {
    expect(getAudioMimeType('xyz')).toBe('audio/mpeg')
  })
})

// ── getFileType ───────────────────────────────────────────────────────────────

describe('getFileType', () => {
  it('extracts the extension in lowercase', () => {
    expect(getFileType('document.pdf')).toBe('pdf')
    expect(getFileType('photo.JPG')).toBe('jpg')
    expect(getFileType('data.CSV')).toBe('csv')
  })

  it('handles filenames with multiple dots', () => {
    expect(getFileType('my.report.v2.docx')).toBe('docx')
  })

  it('returns the lowercased filename when there is no dot', () => {
    // No extension separator — the whole name is returned lowercased
    expect(getFileType('README')).toBe('readme')
  })
})

// ── IMAGE_TYPES / AUDIO_TYPES constants ──────────────────────────────────────

describe('IMAGE_TYPES', () => {
  it('contains expected image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
      expect(IMAGE_TYPES.has(ext)).toBe(true)
    }
  })
})

describe('AUDIO_TYPES', () => {
  it('contains expected audio extensions', () => {
    for (const ext of ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac', 'opus']) {
      expect(AUDIO_TYPES.has(ext)).toBe(true)
    }
  })
})
