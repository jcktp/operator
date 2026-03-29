import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { seedGlossaryIfEmpty } from '@/lib/knowledge-seed'

export async function GET() {
  await seedGlossaryIfEmpty()
  const terms = await prisma.glossaryTerm.findMany({ orderBy: [{ scope: 'asc' }, { term: 'asc' }] })
  return NextResponse.json({ terms })
}

export async function POST(req: NextRequest) {
  const { term, definition, scope } = await req.json() as { term?: string; definition?: string; scope?: string }
  if (!term?.trim() || !definition?.trim() || !scope?.trim()) {
    return NextResponse.json({ error: 'term, definition, and scope are required' }, { status: 400 })
  }
  const created = await prisma.glossaryTerm.upsert({
    where: { term_scope: { term: term.trim(), scope: scope.trim() } },
    update: { definition: definition.trim() },
    create: { id: crypto.randomUUID(), term: term.trim(), definition: definition.trim(), scope: scope.trim() },
  })
  return NextResponse.json({ term: created })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.glossaryTerm.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
