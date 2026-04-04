import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { loadAiSettings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  await loadAiSettings()

  if (process.env.AIR_GAP_MODE === 'true') {
    return NextResponse.json({ error: 'Air-gap mode is enabled — geocoding is blocked.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('name')?.trim()
  if (!raw) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Strip common transliterated Russian/CIS administrative prefixes that confuse Nominatim
  // г./г = город (city), р-н/р. = район (district), обл. = область (region), etc.
  const name = raw
    .replace(/^(г\.\s*|г\s+|гор\.\s*|город\s+)/i, '')
    .replace(/^(р-н\s+|р\.\s+|район\s+)/i, '')
    .replace(/^(обл\.\s*|область\s+)/i, '')
    .replace(/^(пос\.\s*|поселок\s+|посёлок\s+)/i, '')
    .replace(/^(д\.\s*|деревня\s+)/i, '')
    .replace(/^(с\.\s*|село\s+)/i, '')
    .trim() || raw

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=0`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Operator/1.0 (local app)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ result: null })
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return NextResponse.json({ result: null })
    return NextResponse.json({ result: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } })
  } catch {
    return NextResponse.json({ result: null })
  }
}
