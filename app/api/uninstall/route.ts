import { NextResponse } from 'next/server'
import { execSync, spawn } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { prisma } from '@/lib/db'

// Directories that must never be deleted regardless of what process.cwd() returns
const FORBIDDEN_DIRS = new Set(['/', '/usr', '/usr/local', '/bin', '/sbin', '/etc', '/System', '/Library', '/Applications'])

export async function POST() {
  const appDir = process.cwd()
  const home = homedir()

  // Safety: refuse if appDir is a system path, home dir, or suspiciously short
  if (
    FORBIDDEN_DIRS.has(appDir) ||
    appDir === home ||
    appDir.length < 10 ||
    !appDir.includes('/') // should always be an absolute path on macOS/Linux
  ) {
    return NextResponse.json({ error: 'Safety check failed — refusing to delete this directory' }, { status: 400 })
  }

  // 1. Remove the Ollama model that was pulled for this app
  try {
    const settings = await prisma.setting.findMany()
    const s = Object.fromEntries(settings.map(x => [x.key, x.value]))
    if ((!s.ai_provider || s.ai_provider === 'ollama') && s.ollama_model) {
      execSync(`ollama rm ${s.ollama_model}`, { timeout: 15_000, stdio: 'pipe' })
    }
  } catch {
    // Ollama not running or model not found — continue anyway
  }

  // 2. Delete the reports folder at ~/Documents/Operator Reports/
  try {
    const reportsDir = join(home, 'Documents', 'Operator Reports')
    if (existsSync(reportsDir)) {
      rmSync(reportsDir, { recursive: true, force: true })
    }
  } catch {
    // Non-fatal — continue
  }

  // 3. Schedule deletion of the app directory after the process exits.
  //    The shell command only deletes exactly appDir — nothing else.
  const safeDir = appDir.replace(/'/g, "'\\''") // escape single quotes in path
  const deleteCmd = `sleep 3 && rm -rf '${safeDir}'`
  spawn('sh', ['-c', deleteCmd], { detached: true, stdio: 'ignore' }).unref()

  // 4. Exit the server after the response is sent
  setTimeout(() => process.exit(0), 800)

  return NextResponse.json({ ok: true })
}
