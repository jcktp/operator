import { execSync, spawn } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { prisma } from './db'

const FORBIDDEN = new Set(['/', '/usr', '/usr/local', '/bin', '/sbin', '/etc', '/System', '/Library', '/Applications'])

export async function triggerUninstall(): Promise<void> {
  const appDir = process.cwd()
  const home = homedir()

  if (FORBIDDEN.has(appDir) || appDir === home || appDir.length < 10) return

  // 1. Remove the Ollama model pulled for this app
  try {
    const rows = await prisma.setting.findMany()
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]))
    if ((!s.ai_provider || s.ai_provider === 'ollama') && s.ollama_model) {
      execSync(`ollama rm ${s.ollama_model}`, { timeout: 15_000, stdio: 'pipe' })
    }
  } catch {}

  // 2. Delete reports folder
  try {
    const reportsDir = join(home, 'Documents', 'Operator Reports')
    if (existsSync(reportsDir)) rmSync(reportsDir, { recursive: true, force: true })
  } catch {}

  // 3. Schedule self-deletion and exit
  const safeDir = appDir.replace(/'/g, "'\\''")
  spawn('sh', ['-c', `sleep 3 && rm -rf '${safeDir}'`], { detached: true, stdio: 'ignore' }).unref()
  setTimeout(() => process.exit(0), 800)
}
