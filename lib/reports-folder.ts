import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, unlinkSync } from 'fs'

export function getReportsRoot(): string {
  return join(homedir(), 'Documents', 'Operator Reports')
}

/** @deprecated Use project-scoped paths instead. Kept for open-folder route compatibility. */
export function getAreaFolder(area: string): string {
  return join(getReportsRoot(), area)
}

/**
 * Sanitise a project name so it is safe as a folder name on macOS, Linux, and Windows.
 * Falls back to "General" if the result is empty after sanitisation.
 */
export function sanitizeProjectName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')  // chars invalid on most filesystems
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim()
    .replace(/^\.+/, '')             // no leading dots (hidden on Unix)
    .slice(0, 80)                    // reasonable max length
    || 'General'
}

/**
 * Map a file extension to a human-readable type bucket used as a subfolder name.
 */
export function getFileTypeBucket(fileExtension: string): string {
  const ext = fileExtension.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'Photos'
  if (['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac', 'opus'].includes(ext)) return 'Audio'
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'Video'
  return 'Text'
}

export function deleteReportFile(relativePath: string): void {
  try {
    unlinkSync(join(getReportsRoot(), relativePath))
  } catch { /* file already gone — ignore */ }
}

/**
 * Save a file into the structured reports folder and return its path relative to getReportsRoot().
 *
 * New structure:
 *   {projectName}/{area}/{bucket}/{YYYY-MM-DD}/{filename}
 *
 * Backward-compatible: existing DB rows with old-style relative paths (e.g. "Finance/report.pdf")
 * still resolve correctly since serving routes do join(getReportsRoot(), relativePath).
 *
 * @param buffer      File contents
 * @param fileName    Original filename (used as the stored filename)
 * @param area        Classification area (e.g. "Finance")
 * @param projectName Optional project name — sanitised and used as the top-level folder.
 *                    Falls back to "General" when omitted or blank.
 * @returns           Relative path from getReportsRoot() (e.g. "Project Alpha/Finance/Text/2025-03-15/report.pdf")
 */
export function saveReportFile(
  buffer: Buffer,
  fileName: string,
  area: string,
  projectName?: string,
): string {
  const project = projectName ? sanitizeProjectName(projectName) : 'General'
  const ext = fileName.split('.').pop() ?? ''
  const bucket = getFileTypeBucket(ext)
  const date = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD

  const relativeDir = join(project, area, bucket, date)
  const dir = join(getReportsRoot(), relativeDir)
  mkdirSync(dir, { recursive: true })

  // Write without overwriting — prefix with ms timestamp on collision
  const target = join(dir, fileName)
  try {
    writeFileSync(target, buffer, { flag: 'wx' })
    return join(relativeDir, fileName)
  } catch {
    const ts = Date.now()
    const dotExt = ext ? `.${ext}` : ''
    const base = fileName.replace(/\.[^/.]+$/, '')
    const uniqueName = `${base}_${ts}${dotExt}`
    writeFileSync(join(dir, uniqueName), buffer)
    return join(relativeDir, uniqueName)
  }
}
