import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
import { pool } from '../src/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const schema = readFileSync(join(__dirname, '..', 'src', 'schema.sql'), 'utf8')

try {
  await pool.query(schema)
  console.log(`[migrate] schema applied to ${process.env.DATABASE_URL}`)
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  )
  tables.rows.forEach((t) => console.log(`[migrate]   table: ${t.table_name}`))
} finally {
  await pool.end()
}