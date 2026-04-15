/**
 * Utility functions for facial recognition features.
 * No React, no browser APIs — safe to import from server components and API routes.
 */
import { resolve, join, extname } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { getReportsRoot } from '@/lib/reports-folder'

/**
 * Returns true if the given absolute image path is within the reports root.
 * Guards against path traversal attacks (e.g. ../../../etc/passwd).
 */
export function validateImagePath(absolutePath: string): boolean {
  const root = resolve(getReportsRoot())
  const abs = resolve(absolutePath)
  return abs.startsWith(root + '/')
}

/**
 * Parse a JSON-encoded bbox string into a [x, y, w, h] tuple.
 * Returns null if the JSON is malformed or not a 4-element numeric array.
 */
export function parseBbox(json: string): [number, number, number, number] | null {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr) || arr.length !== 4) return null
    if (!arr.every((v) => typeof v === 'number' && isFinite(v))) return null
    return arr as [number, number, number, number]
  } catch {
    return null
  }
}

/**
 * Serialize a float[] embedding to a compact JSON string for DB storage.
 */
export function serializeEmbedding(embedding: number[]): string {
  return JSON.stringify(embedding)
}

/**
 * Deserialize a JSON string from the DB back to a float[].
 */
export function deserializeEmbedding(json: string): number[] {
  return JSON.parse(json) as number[]
}

/**
 * Save an uploaded image file into the reports root under Faces/{projectId}/{date}/
 * Returns both the absolute path (for the Python service) and the relative path (for DB storage).
 */
export async function saveUploadedFaceImage(
  file: Blob,
  originalName: string,
  projectId: string,
): Promise<{ absolutePath: string; relativePath: string }> {
  const root = getReportsRoot()
  const ext = extname(originalName) || '.jpg'
  const date = new Date().toISOString().slice(0, 10)
  const relDir = join('Faces', projectId, date)
  const absDir = join(root, relDir)
  mkdirSync(absDir, { recursive: true })
  const filename = `${randomUUID()}${ext}`
  const absPath = join(absDir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  writeFileSync(absPath, buffer)
  return { absolutePath: absPath, relativePath: join(relDir, filename) }
}
