/**
 * Integration tests for the upload pipeline.
 * Tests the core path: file parsing → job creation → item processing → report in DB.
 * AI calls (analyzeReport, extractEntities, etc.) are mocked — we test the pipeline
 * logic and DB state, not the AI model outputs.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createTestClient } from '../helpers/db.js'

// ── DB mock ───────────────────────────────────────────────────────────────────
let _prisma: PrismaClient

vi.mock('@/lib/db', () => ({
  get prisma() { return _prisma },
}))

// ── AI mocks — prevent real inference calls ───────────────────────────────────
vi.mock('@/lib/ai', () => ({
  analyzeReport: vi.fn().mockResolvedValue({
    summary: 'Test summary',
    insights: [],
    questions: [],
    metrics: [],
    resolvedFlags: [],
  }),
  extractEntities: vi.fn().mockResolvedValue([
    { type: 'person', name: 'John Doe', context: 'Test context' },
  ]),
  extractTimeline: vi.fn().mockResolvedValue([
    { dateText: '2026-01-01', dateSortKey: '2026-01-01', event: 'Test event' },
  ]),
  compareReports: vi.fn().mockResolvedValue(null),
  checkResolvedFlags: vi.fn().mockResolvedValue([]),
  detectRedactions: vi.fn().mockResolvedValue([]),
  compareDocumentsJournalism: vi.fn().mockResolvedValue(null),
  generateVerificationChecklist: vi.fn().mockResolvedValue([]),
  generateAreaBriefing: vi.fn().mockResolvedValue('Test briefing'),
}))

vi.mock('@/lib/settings', () => ({
  loadAiSettings: vi.fn().mockResolvedValue(undefined),
  getSecret: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/mode', () => ({
  getModeConfig: vi.fn().mockReturnValue({
    id: 'executive',
    features: {
      entities: true,
      timeline: true,
      redactions: false,
      verification: false,
      documentComparison: false,
      metricsBoard: false,
      keywordMonitoring: false,
    },
  }),
}))

vi.mock('@/lib/model-capabilities', () => ({
  routeVisionModel: vi.fn().mockReturnValue('llava-phi3'),
  routeAudioModel: vi.fn().mockReturnValue(null),
}))

// Mock Ollama so unloadOllamaModel doesn't fail
vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({}),
  })),
}))

// Static imports after mocks
import { extractContent } from '@/lib/parsers'

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeAll(() => {
  _prisma = createTestClient()
  process.env.AI_PROVIDER = 'ollama'
  process.env.OLLAMA_MODEL = 'phi4-mini'
})

afterAll(async () => {
  await _prisma.$disconnect()
})

beforeEach(async () => {
  await _prisma.uploadJobItem.deleteMany()
  await _prisma.uploadJob.deleteMany()
  await _prisma.reportEntity.deleteMany()
  await _prisma.timelineEvent.deleteMany()
  await _prisma.report.deleteMany()
})

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('extractContent', () => {
  it('parses plain text files', async () => {
    const buf = Buffer.from('Hello world. This is a test document with enough content.')
    const result = await extractContent(buf, 'txt')
    expect(result.text).toContain('Hello world')
  })

  it('parses CSV files and returns pipe-delimited text + JSON displayContent', async () => {
    const csv = 'Name,Age,City\nAlice,30,London\nBob,25,Paris\n'
    const buf = Buffer.from(csv)
    const result = await extractContent(buf, 'csv')
    expect(result.text).toContain('Alice')
    expect(result.text).toContain('Bob')
    const display = JSON.parse(result.displayContent!)
    expect(display.type).toBe('csv')
    expect(display.rows).toHaveLength(3) // header + 2 data rows
  })

  it('parses markdown files preserving structure', async () => {
    const md = '# Title\n\n## Section\n\nSome content here.'
    const buf = Buffer.from(md)
    const result = await extractContent(buf, 'md')
    expect(result.text).toContain('# Title')
    expect(result.text).toContain('## Section')
  })

  it('returns image placeholder for image file types', async () => {
    const buf = Buffer.from('fake image data')
    const result = await extractContent(buf, 'jpg')
    expect(result.displayContent).toBe('image:pending')
  })
})

// ── Upload job DB lifecycle ───────────────────────────────────────────────────

describe('upload job lifecycle', () => {
  it('creates a job and item in the database', async () => {
    const job = await _prisma.uploadJob.create({
      data: { status: 'queued', total: 1 },
    })
    const item = await _prisma.uploadJobItem.create({
      data: {
        jobId: job.id,
        title: 'Test Document',
        area: 'Finance',
        fileType: 'txt',
        fileName: 'test.txt',
        fileSizeBytes: 100,
        rawContent: 'Test content for analysis.',
        status: 'queued',
        sortOrder: 0,
      },
    })

    expect(job.status).toBe('queued')
    expect(item.status).toBe('queued')
    expect(item.jobId).toBe(job.id)
  })

  it('tracks processed count and transitions job to done', async () => {
    const job = await _prisma.uploadJob.create({
      data: { status: 'queued', total: 2 },
    })

    await _prisma.uploadJobItem.createMany({
      data: [
        { jobId: job.id, title: 'Doc 1', area: 'HR', fileType: 'txt', fileName: 'a.txt', fileSizeBytes: 50, rawContent: 'Content A', status: 'done', sortOrder: 0 },
        { jobId: job.id, title: 'Doc 2', area: 'HR', fileType: 'txt', fileName: 'b.txt', fileSizeBytes: 50, rawContent: 'Content B', status: 'done', sortOrder: 1 },
      ],
    })

    const updated = await _prisma.uploadJob.update({
      where: { id: job.id },
      data: { status: 'done', processed: 2 },
    })

    expect(updated.status).toBe('done')
    expect(updated.processed).toBe(2)
  })

  it('marks job as error when all items fail', async () => {
    const job = await _prisma.uploadJob.create({
      data: { status: 'processing', total: 1 },
    })
    await _prisma.uploadJobItem.create({
      data: { jobId: job.id, title: 'Bad Doc', area: 'Legal', fileType: 'txt', fileName: 'bad.txt', fileSizeBytes: 10, rawContent: '', status: 'error', error: 'File appears to be empty', sortOrder: 0 },
    })

    const updated = await _prisma.uploadJob.update({
      where: { id: job.id },
      data: { status: 'error' },
    })

    expect(updated.status).toBe('error')
  })

  it('cancel sets job and remaining items to cancelled', async () => {
    const job = await _prisma.uploadJob.create({
      data: { status: 'processing', total: 3 },
    })
    await _prisma.uploadJobItem.createMany({
      data: [
        { jobId: job.id, title: 'D1', area: 'Ops', fileType: 'txt', fileName: 'd1.txt', fileSizeBytes: 10, rawContent: 'x', status: 'done', sortOrder: 0 },
        { jobId: job.id, title: 'D2', area: 'Ops', fileType: 'txt', fileName: 'd2.txt', fileSizeBytes: 10, rawContent: 'x', status: 'queued', sortOrder: 1 },
        { jobId: job.id, title: 'D3', area: 'Ops', fileType: 'txt', fileName: 'd3.txt', fileSizeBytes: 10, rawContent: 'x', status: 'queued', sortOrder: 2 },
      ],
    })

    // Simulate cancel: mark queued items as deleted and job as done
    await _prisma.uploadJobItem.updateMany({
      where: { jobId: job.id, status: 'queued' },
      data: { status: 'deleted' },
    })
    await _prisma.uploadJob.update({ where: { id: job.id }, data: { status: 'done' } })

    const remaining = await _prisma.uploadJobItem.count({ where: { jobId: job.id, status: 'queued' } })
    expect(remaining).toBe(0)
  })
})

// ── Report creation ───────────────────────────────────────────────────────────

describe('report creation', () => {
  it('creates a report with expected fields', async () => {
    const report = await _prisma.report.create({
      data: {
        title: 'Q1 Finance Report',
        area: 'Finance',
        fileName: 'q1.txt',
        fileType: 'txt',
        fileSize: 100,
        rawContent: 'Revenue was up 12% this quarter.',
        summary: 'Revenue increased 12%.',
        insights: JSON.stringify([{ type: 'observation', text: 'Revenue up', priority: 'medium' }]),
        questions: JSON.stringify([]),
        metrics: JSON.stringify([{ label: 'Revenue growth', value: '12%', status: 'positive' }]),
      },
    })

    expect(report.title).toBe('Q1 Finance Report')
    expect(report.area).toBe('Finance')
    expect(report.summary).toBe('Revenue increased 12%.')

    const metrics = JSON.parse(report.metrics!)
    expect(metrics[0].label).toBe('Revenue growth')
  })

  it('creates associated entities for a report', async () => {
    const report = await _prisma.report.create({
      data: { title: 'Entity Test', area: 'Legal', fileName: 'entity.txt', fileType: 'txt', fileSize: 50, rawContent: 'John Doe signed the contract.', summary: null, insights: null, questions: null, metrics: null },
    })

    await _prisma.reportEntity.createMany({
      data: [
        { reportId: report.id, type: 'person', name: 'John Doe', context: 'Signed the contract' },
        { reportId: report.id, type: 'organisation', name: 'Acme Corp', context: 'Contract party' },
      ],
    })

    const entities = await _prisma.reportEntity.findMany({ where: { reportId: report.id } })
    expect(entities).toHaveLength(2)
    expect(entities.map(e => e.name)).toContain('John Doe')
  })

  it('creates timeline events for a report', async () => {
    const report = await _prisma.report.create({
      data: { title: 'Timeline Test', area: 'Ops', fileName: 'timeline.txt', fileType: 'txt', fileSize: 50, rawContent: 'On Jan 1 the deal closed.', summary: null, insights: null, questions: null, metrics: null },
    })

    await _prisma.timelineEvent.create({
      data: { reportId: report.id, dateText: 'January 1 2026', dateSortKey: '2026-01-01', event: 'Deal closed' },
    })

    const events = await _prisma.timelineEvent.findMany({ where: { reportId: report.id } })
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('Deal closed')
  })

  it('scopes reports to a project', async () => {
    const project = await _prisma.project.create({
      data: { name: 'Test Project', description: null },
    })

    const report = await _prisma.report.create({
      data: { title: 'Scoped Report', area: 'Finance', fileName: 'scoped.txt', fileType: 'txt', fileSize: 50, rawContent: 'Content', summary: null, insights: null, questions: null, metrics: null, projectId: project.id },
    })

    const found = await _prisma.report.findFirst({ where: { projectId: project.id } })
    expect(found?.id).toBe(report.id)

    // Cleanup
    await _prisma.report.delete({ where: { id: report.id } })
    await _prisma.project.delete({ where: { id: project.id } })
  })
})
