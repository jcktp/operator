import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateDashboardInsights } from '@/lib/ai'

export async function GET() {
  // Apply saved Ollama settings
  const allSettings = await prisma.setting.findMany()
  for (const s of allSettings) {
    if (s.key === 'ollama_host') process.env.OLLAMA_HOST = s.value
    if (s.key === 'ollama_model') process.env.OLLAMA_MODEL = s.value
  }

  // Get the most recent report per area
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      area: true,
      summary: true,
      metrics: true,
      insights: true,
    },
  })

  if (reports.length === 0) {
    return NextResponse.json({
      crossInsights: [],
      topQuestions: [],
      healthSignal: 'No reports uploaded yet.',
    })
  }

  const validReports = reports.filter(r => r.summary) as Array<{
    area: string
    summary: string
    metrics: string
    insights: string
  }>

  try {
    const result = await generateDashboardInsights(validReports)
    return NextResponse.json(result)
  } catch (e) {
    console.error('Insights generation failed:', e)
    return NextResponse.json({ error: 'Could not generate insights' }, { status: 500 })
  }
}
