import { execSync, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'

let tunnelProcess: ChildProcess | null = null
let tunnelUrl: string | null = null

export function isCloudflaredInstalled(): boolean {
  try {
    execSync('which cloudflared', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function isTunnelRunning(): boolean {
  return tunnelProcess !== null && tunnelUrl !== null
}

export function getTunnelUrl(): string | null {
  return tunnelUrl
}

export async function startTunnel(port = 3000): Promise<string> {
  if (tunnelProcess && tunnelUrl) return tunnelUrl

  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    tunnelProcess = proc
    const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

    let resolved = false

    const handleData = (data: Buffer) => {
      const text = data.toString()
      const match = text.match(urlRegex)
      if (match && !resolved) {
        resolved = true
        tunnelUrl = match[0]
        resolve(tunnelUrl)
      }
    }

    proc.stdout?.on('data', handleData)
    proc.stderr?.on('data', handleData)

    proc.on('error', (err) => {
      tunnelProcess = null
      tunnelUrl = null
      if (!resolved) reject(err)
    })

    proc.on('exit', () => {
      tunnelProcess = null
      tunnelUrl = null
    })

    // Timeout after 30s if URL never appears
    setTimeout(() => {
      if (!resolved) {
        proc.kill()
        tunnelProcess = null
        tunnelUrl = null
        reject(new Error('Timed out waiting for Cloudflare tunnel URL'))
      }
    }, 30_000)
  })
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
    tunnelUrl = null
  }
}

// Clean up on process exit
process.on('exit', stopTunnel)
process.on('SIGINT', () => { stopTunnel(); process.exit() })
process.on('SIGTERM', () => { stopTunnel(); process.exit() })
