import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, unlinkSync } from 'fs'

export function getReportsRoot(): string {
  return join(homedir(), 'Documents', 'Operator Reports')
}

export function getAreaFolder(area: string): string {
  return join(getReportsRoot(), area)
}

export function deleteReportFile(relativePath: string): void {
  try {
    unlinkSync(join(getReportsRoot(), relativePath))
  } catch { /* file already gone — ignore */ }
}

export function saveReportFile(buffer: Buffer, fileName: string, area: string): string {
  const dir = getAreaFolder(area)
  mkdirSync(dir, { recursive: true })

  // Avoid collisions: prefix with timestamp if file already exists
  const filePath = join(dir, fileName)
  try {
    writeFileSync(filePath, buffer, { flag: 'wx' })
    return filePath
  } catch {
    const ts = new Date().toISOString().slice(0, 10)
    const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : ''
    const base = fileName.replace(/\.[^/.]+$/, '')
    const unique = join(dir, `${base}_${ts}${ext}`)
    writeFileSync(unique, buffer)
    return unique
  }
}
