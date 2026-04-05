/**
 * Creates a PrismaClient pointed at the test database.
 * Import this in integration test files and wire it up via vi.mock('@/lib/db').
 */
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { TEST_DB_PATH } from '../setup/config.js'

export function createTestClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH })
  return new PrismaClient({ adapter })
}
