import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { loadAiSettings } from '@/lib/settings'

async function queryNominatim(q: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'Operator/1.0 (local app)' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat: string; lon: string }>
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

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

  // Strip common prefixes that confuse Nominatim:
  // English place-type prefixes (City of, Town of, Village of, Port of, Bar …, etc.)
  // Russian/CIS administrative prefixes (г., р-н, обл., пос., д., с.)
  const name = raw
    .replace(/^(city of|town of|village of|municipality of|district of|port of|county of|province of|region of)\s+/i, '')
    .replace(/^(bar|pub|café|cafe|restaurant|hotel|club)\s+/i, '')
    .replace(/^(г\.\s*|г\s+|гор\.\s*|город\s+)/i, '')
    .replace(/^(р-н\s+|р\.\s+|район\s+)/i, '')
    .replace(/^(обл\.\s*|область\s+)/i, '')
    .replace(/^(пос\.\s*|поселок\s+|посёлок\s+)/i, '')
    .replace(/^(д\.\s*|деревня\s+)/i, '')
    .replace(/^(с\.\s*|село\s+)/i, '')
    .trim() || raw

  try {
    const result = await queryNominatim(name)
    if (result) return NextResponse.json({ result })

    // Nominatim struggles with long multi-part addresses (e.g. "Swissôtel Tallinn, Tornimäe 3, Harju County, Estonia").
    // Progressively drop parts from the middle and retry with simpler queries.
    const parts = name.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 3) {
      // Try first + last parts (e.g. "Swissôtel Tallinn, Estonia")
      const shortQuery = `${parts[0]}, ${parts[parts.length - 1]}`
      const r1 = await queryNominatim(shortQuery)
      if (r1) return NextResponse.json({ result: r1 })

      // Try first two parts (e.g. "Swissôtel Tallinn, Tornimäe 3")
      const r2 = await queryNominatim(parts.slice(0, 2).join(', '))
      if (r2) return NextResponse.json({ result: r2 })
    }

    // Try just the first part (e.g. "Swissôtel Tallinn")
    if (parts.length >= 2) {
      const r3 = await queryNominatim(parts[0])
      if (r3) return NextResponse.json({ result: r3 })
    }

    return NextResponse.json({ result: null })
  } catch {
    return NextResponse.json({ result: null })
  }
}
