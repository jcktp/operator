/**
 * Vitest global setup — runs once before the entire test suite.
 * Creates a fresh SQLite test database with all migrations applied.
 * Tears it down after all tests complete.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { TEST_DB_PATH } from './config.js'

export async function setup() {
  const dir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // Always start from a clean slate
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = TEST_DB_PATH + suffix
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  // Apply all existing migrations to the test DB
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: 'pipe',
    cwd: process.cwd(),
  })
}

export async function teardown() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = TEST_DB_PATH + suffix
    try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch { /* best effort */ }
  }
}
