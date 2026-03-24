import { execSync, spawn } from 'child_process'
import * as os from 'os'
import type { ChildProcess } from 'child_process'

let tunnelProcess: ChildProcess | null = null
let tunnelUrl: string | null = null

export function getLocalNetworkUrl(port = 3000): string | null {
  try {
    const interfaces = os.networkInterfaces()
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return `http://${addr.address}:${port}`
        }
      }
    }
  } catch { /* ignore */ }
  return null
}

export function isCloudflaredInstalled(): boolean {
  try {
    execSync('which cloudflared', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Alias
export { isCloudflaredInstalled as isTunnelAvailable }

export function isTunnelRunning(): boolean {
  return tunnelProcess !== null && tunnelUrl !== null
}

export function getTunnelUrl(): string | null {
  return tunnelUrl
}

export async function startTunnel(port = 3000): Promise<string> {
  if (tunnelProcess && tunnelUrl) return tunnelUrl

  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    tunnelProcess = proc
    let resolved = false

    // cloudflared emits the URL in stderr log lines
    const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

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
      if (!resolved) reject(new Error(`cloudflared failed to start: ${err.message}`))
    })

    proc.on('exit', (code) => {
      tunnelProcess = null
      tunnelUrl = null
      if (!resolved) reject(new Error(`cloudflared exited early (code ${code})`))
    })

    setTimeout(() => {
      if (!resolved) {
        proc.kill()
        tunnelProcess = null
        tunnelUrl = null
        reject(new Error('Timed out waiting for cloudflared tunnel URL'))
      }
    }, 45_000)
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
