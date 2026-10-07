import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import createAuthRouter from './routes/auth.js'
import bugsRouter from './routes/bugs.js'
import {
  errorHandler,
  notFoundHandler,
  requestId,
  requestLogger,
} from './middleware.js'
import { query } from './db.js'
import { openapiSpec } from './openapi.js'

export function createApp(config) {
  const app = express()
  app.locals.config = config

  app.set('trust proxy', config.trustProxy) // real client IP behind Nginx / ALB

  app.use(helmet())
  app.use(
    cors({
      origin: config.corsOrigin,
      // Allow pre-signed S3 URLs to be consumed cross-origin (they are not
      // fetched by the API; the browser hits S3 directly).
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  app.use(express.json({ limit: '50kb' }))

  app.use(requestId)
  app.use(requestLogger)

  app.get('/api/health', async (_req, res) => {
    let db = 'up'
    try {
      await query('SELECT 1')
    } catch {
      db = 'down'
    }
    res.json({
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  })

  app.use('/api', createAuthRouter())

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

  app.use('/api', bugsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}