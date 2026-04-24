import { prisma } from './db'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100

/** Split text into overlapping chunks for embedding */
export function chunkText(content: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!content || content.length <= chunkSize) return [content]
  const chunks: string[] = []
  let start = 0
  while (start < content.length) {
    chunks.push(content.slice(start, start + chunkSize))
    start += chunkSize - overlap
  }
  return chunks
}

/** Generate an embedding vector via Ollama's /api/embed endpoint */
export async function generateEmbedding(text: string): Promise<number[]> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const res = await fetch(`${host}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
  })
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`)
  const data = await res.json() as { embeddings: number[][] }
  return data.embeddings[0]
}

/** Cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

/** Chunk a report's content and store embeddings in the database */
export async function embedReport(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { rawContent: true },
  })
  if (!report?.rawContent) return

  // Remove any existing embeddings for this report
  await prisma.reportEmbedding.deleteMany({ where: { reportId } })

  const chunks = chunkText(report.rawContent)
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i])
    await prisma.reportEmbedding.create({
      data: {
        reportId,
        chunk: i,
        embedding: JSON.stringify(embedding),
      },
    })
  }
}
