import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { closePool } from './db.js'
import { logger } from './logger.js'

// loadConfig throws if JWT_SECRET is missing: fail fast at startup.
const config = loadConfig()

const app = createApp(config)

const server = app.listen(config.port, () => {
  logger.info('api started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    s3Bucket: config.s3Bucket || '(not configured)',
  })
})

function shutdown(signal) {
  logger.info('shutting down', { signal })
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
  // Force exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))