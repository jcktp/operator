import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ReportAnalysis {
  summary: string
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
}

export interface Metric {
  label: string
  value: string
  context?: string
  trend?: 'up' | 'down' | 'flat' | 'unknown'
  status?: 'positive' | 'negative' | 'neutral' | 'warning'
}

export interface Insight {
  type: 'observation' | 'anomaly' | 'risk' | 'opportunity'
  text: string
  area?: string
}

export interface Question {
  text: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const prompt = `You are analyzing a business report for a CEO. Your job is to extract and understand the data AS-IS — do not invent, change, or extrapolate numbers. Present exactly what the report contains.

Report Title: ${reportTitle}
Business Area: ${area}
${directName ? `From: ${directName}` : ''}

Report Content:
---
${content.slice(0, 12000)}
---

Respond with a JSON object with this exact structure:
{
  "summary": "2-3 sentence plain-language summary of what this report covers and the overall picture. Be direct and factual.",
  "metrics": [
    {
      "label": "metric name",
      "value": "exact value as reported",
      "context": "vs plan, vs prior period, or any context given in the report",
      "trend": "up | down | flat | unknown",
      "status": "positive | negative | neutral | warning"
    }
  ],
  "insights": [
    {
      "type": "observation | anomaly | risk | opportunity",
      "text": "specific, factual observation based only on what the report contains",
      "area": "which part of the business this relates to"
    }
  ],
  "questions": [
    {
      "text": "A specific question the CEO should ask this direct report",
      "why": "Why this question matters based on what the report shows",
      "priority": "high | medium | low"
    }
  ]
}

Rules:
- metrics: extract all concrete numbers, percentages, and figures mentioned. Maximum 15.
- insights: flag anomalies, things that stand out, risks, or opportunities visible in the data. Maximum 8.
- questions: generate smart follow-up questions based on gaps, concerns, or notable items. Maximum 6.
- Never invent data. Only work with what's in the report.
- Keep language executive-level: direct, concise, no jargon.`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')

  return JSON.parse(jsonMatch[0]) as ReportAnalysis
}

export async function generateDashboardInsights(
  reports: Array<{ area: string; summary: string; metrics: string; insights: string }>
): Promise<{ crossInsights: Insight[]; topQuestions: Question[]; healthSignal: string }> {
  if (reports.length === 0) {
    return { crossInsights: [], topQuestions: [], healthSignal: 'No reports available.' }
  }

  const reportsText = reports
    .map(r => {
      let metricsData: Metric[] = []
      let insightsData: Insight[] = []
      try {
        metricsData = JSON.parse(r.metrics || '[]')
        insightsData = JSON.parse(r.insights || '[]')
      } catch {}
      return `Area: ${r.area}\nSummary: ${r.summary}\nKey metrics: ${metricsData.map(m => `${m.label}: ${m.value}`).join(', ')}\nInsights: ${insightsData.map(i => i.text).join('; ')}`
    })
    .join('\n\n---\n\n')

  const prompt = `You are a strategic advisor helping a CEO understand their business based on recent reports from their direct reports.

Here are summaries from recent reports across different business areas:

${reportsText}

Respond with a JSON object:
{
  "healthSignal": "1-2 sentence overall company health assessment based on these reports. Be direct.",
  "crossInsights": [
    {
      "type": "observation | anomaly | risk | opportunity",
      "text": "Pattern or insight that spans multiple areas or is particularly important",
      "area": "which areas this relates to"
    }
  ],
  "topQuestions": [
    {
      "text": "The most important question the CEO should be asking right now",
      "why": "Why this matters across the business",
      "priority": "high | medium | low"
    }
  ]
}

Rules:
- crossInsights: maximum 5, focus on cross-functional patterns or critical signals
- topQuestions: maximum 5, the questions that matter most given the full picture
- Only draw from what the reports contain. No invented data.`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')

  return JSON.parse(jsonMatch[0])
}
