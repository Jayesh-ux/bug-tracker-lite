// Runs before every test file. Points the app at the dedicated test database
// and applies the schema. Docker compose provisions `bugtracker_test`; in CI
// the Postgres service does the same.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.BUGTRACKER_TEST_URL ||
  'postgres://bugtracker:bugtracker@localhost:5432/bugtracker_test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-reuse'
process.env.AWS_REGION = 'us-east-1'
process.env.S3_BUCKET = 'bug-tracker-lite-images-test'
process.env.PG_POOL_MAX = '5'
process.env.CORS_ORIGIN = 'http://localhost:5173'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from '../src/db.js'

const root = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(join(root, '..', 'src', 'schema.sql'), 'utf8')

try {
  await pool.query(schema)
} catch (err) {
  // Make failures loud: the test database must be reachable.
  console.error('\n[setup] Could not apply schema to the test database:', err.message)
  console.error(
    '[setup] Start Postgres (`docker compose up -d postgres`) which provisions `bugtracker_test`, then re-run `npm test`.'
  )
  throw err
}