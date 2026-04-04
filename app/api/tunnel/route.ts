import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isCloudflaredInstalled, isTunnelRunning, getTunnelUrl, startTunnel, stopTunnel, getLocalNetworkUrl } from '@/lib/tunnel'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  return NextResponse.json({
    installed: isCloudflaredInstalled(),
    running: isTunnelRunning(),
    url: getTunnelUrl(),
    localUrl: getLocalNetworkUrl(),
  })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const body = await req.json() as { action?: string }

  if (body.action === 'start') {
    if (!isCloudflaredInstalled()) {
      return NextResponse.json({ error: 'cloudflared not installed' }, { status: 400 })
    }
    try {
      const url = await startTunnel()
      return NextResponse.json({ installed: true, running: true, url })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  if (body.action === 'stop') {
    stopTunnel()
    return NextResponse.json({ installed: isCloudflaredInstalled(), running: false, url: null })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
