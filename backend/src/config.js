import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(backendRoot, '.env') })

export function loadConfig() {
  const env = process.env

  if (!env.JWT_SECRET) {
    throw new Error(
      'FATAL: JWT_SECRET is missing. Copy backend/.env.example to backend/.env and set JWT_SECRET (fail fast at startup).'
    )
  }

  return {
    port: Number(env.PORT || 4000),
    nodeEnv: env.NODE_ENV || 'development',
    databaseUrl:
      env.DATABASE_URL || 'postgres://bugtracker:bugtracker@localhost:5432/bugtracker',
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1h',
    corsOrigin: (env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: Number(env.TRUST_PROXY || 1),
    awsRegion: env.AWS_REGION || 'us-east-1',
    s3Bucket: env.S3_BUCKET || '',
  }
}