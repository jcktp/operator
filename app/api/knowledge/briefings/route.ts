import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const briefings = await prisma.areaBriefing.findMany({ orderBy: [{ area: 'asc' }] })
  return NextResponse.json({ briefings })
}
