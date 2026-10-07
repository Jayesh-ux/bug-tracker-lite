import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

// Load .env before constructing the Pool. ESM imports are hoisted, so relying
// on another module to load dotenv first is racy. dotenv never overrides env
// vars that are already set (e.g. by tests).
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(backendRoot, '.env') })

const { Pool } = pg

// RDS and other managed Postgres require TLS. The pg driver ignores libpq's
// sslmode, so SSL is enabled explicitly via PG_SSL_CA (path to a CA bundle,
// e.g. infra/rds/global-bundle.pem). When unset, the pool connects over
// plaintext exactly as before (local Docker dev).
function sslConfig() {
  const caPath = process.env.PG_SSL_CA
  if (!caPath) return undefined
  return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
  query_timeout: 10_000,
  max: Number(process.env.PG_POOL_MAX || 10),
})

// Single entry point for all SQL so parameterized queries are the only option.
export function query(text, params) {
  return pool.query(text, params)
}

export async function closePool() {
  await pool.end()
}