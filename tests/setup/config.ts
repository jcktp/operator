import path from 'path'

/** Absolute path to the isolated SQLite database used by integration tests. */
export const TEST_DB_PATH = path.resolve(process.cwd(), 'tests/test-data/test.db')
