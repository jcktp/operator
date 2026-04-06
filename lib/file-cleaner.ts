/**
 * file-cleaner.ts
 *
 * Shared logic for metadata inspection and stripping.
 * Two tools are supported:
 *   - MAT2  (Python CLI) — broad format support: PDF, DOCX, XLSX, ODF, EPUB, ZIP, images, audio/video
 *   - ExifTool (exiftool-vendored, self-bundled) — targeted EXIF stripping; excellent image support
 *
 * All public functions accept absolute paths. Callers must validate that the path
 * is within getReportsRoot() before calling — use assertWithinRoot() for this.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolve, join, basename, extname } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { ExifTool } from 'exiftool-vendored'
import { getReportsRoot } from '@/lib/reports-folder'
import { EXIFTOOL_EXTENSIONS } from '@/lib/file-cleaner-shared'
export { MAT2_EXTENSIONS, EXIFTOOL_EXTENSIONS, SENSITIVE_TAG_PREFIXES } from '@/lib/file-cleaner-shared'

const execFileAsync = promisify(execFile)

// ── ExifTool singleton ────────────────────────────────────────────────────────
// One persistent process per server process; cleaned up on process exit.
let _exiftool: ExifTool | null = null

export function getExifTool(): ExifTool {
  if (!_exiftool) {
    _exiftool = new ExifTool({ taskTimeoutMillis: 15_000, maxProcs: 2 })
    process.once('exit', () => _exiftool?.end())
  }
  return _exiftool
}

// ── Path guard ────────────────────────────────────────────────────────────────

export type PathGuardResult =
  | { ok: true; root: string; abs: string }
  | { ok: false; error: string }

/**
 * Resolve a relative path against getReportsRoot() and confirm it stays within it.
 * Returns the absolute path on success, or an error string on failure.
 */
export function resolveWithinRoot(relativePath: string): PathGuardResult {
  const root = getReportsRoot()
  const abs = resolve(join(root, relativePath))
  if (!abs.startsWith(root + '/') && abs !== root) {
    return { ok: false, error: 'Path is outside the reports folder' }
  }
  if (!existsSync(abs)) {
    return { ok: false, error: 'File not found' }
  }
  return { ok: true, root, abs }
}

// ── Metadata reading ──────────────────────────────────────────────────────────

export interface MetadataResult {
  tags: Record<string, unknown>
  mat2Supported: boolean
  exiftoolSupported: boolean
}

export async function readMetadata(abs: string): Promise<MetadataResult> {
  const ext = extname(abs).replace('.', '').toLowerCase()

  const [tagsResult, mat2Result] = await Promise.allSettled([
    getExifTool().read(abs),
    checkMat2Support(abs),
  ])

  const rawTags = tagsResult.status === 'fulfilled' ? tagsResult.value as Record<string, unknown> : {}

  // Strip ExifTool internal keys (lowercase 'errors', 'warnings', symbol keys)
  const tags: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawTags)) {
    if (k === 'errors' || k === 'warnings' || k === 'SourceFile') continue
    tags[k] = v
  }

  return {
    tags,
    mat2Supported: mat2Result.status === 'fulfilled' && mat2Result.value,
    exiftoolSupported: EXIFTOOL_EXTENSIONS.has(ext),
  }
}

// ── MAT2 operations ───────────────────────────────────────────────────────────

/**
 * Check if MAT2 supports cleaning the given file.
 * Runs `mat2 --check <file>` — exit 0 means supported.
 */
export async function checkMat2Support(abs: string): Promise<boolean> {
  try {
    await execFileAsync('mat2', ['--check', abs], { timeout: 8_000 })
    return true
  } catch {
    return false
  }
}

export interface CleanResult {
  cleanedAbs: string
  cleanedRelative: string
}

/**
 * Strip metadata using MAT2. Produces a new file at `<name>.cleaned.<ext>` in the same dir.
 * Returns the absolute and relative paths of the cleaned file.
 */
export async function runMat2(abs: string, root: string): Promise<CleanResult> {
  // MAT2 writes to <basename>.cleaned.<ext> by default
  const ext = extname(abs)
  const base = basename(abs, ext)
  const dir = abs.slice(0, abs.lastIndexOf('/'))
  const cleanedAbs = join(dir, `${base}.cleaned${ext}`)

  await execFileAsync('mat2', [abs], { timeout: 90_000 })

  if (!existsSync(cleanedAbs)) {
    throw new Error('MAT2 did not produce a cleaned file')
  }

  const cleanedRelative = cleanedAbs.slice(root.length + 1)
  return { cleanedAbs, cleanedRelative }
}

/**
 * Strip all EXIF metadata using ExifTool. Copies the file to `<name>.cleaned.<ext>`
 * then strips in-place, so the original is never modified.
 */
export async function runExifToolStrip(abs: string, root: string): Promise<CleanResult> {
  const ext = extname(abs)
  const base = basename(abs, ext)
  const dir = abs.slice(0, abs.lastIndexOf('/'))
  const cleanedAbs = join(dir, `${base}.cleaned${ext}`)

  // Copy first so original is preserved
  copyFileSync(abs, cleanedAbs)

  // Strip all writable metadata tags from the copy
  await getExifTool().write(cleanedAbs, {}, { writeArgs: ['-all=', '-overwrite_original'] })

  const cleanedRelative = cleanedAbs.slice(root.length + 1)
  return { cleanedAbs, cleanedRelative }
}
