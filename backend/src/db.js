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

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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