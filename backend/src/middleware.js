import jwt from 'jsonwebtoken'
import { logger } from './logger.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

// Wraps async route handlers so rejections flow to the central error handler.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isValidUUID = (value) =>
  typeof value === 'string' && UUID_RE.test(value)

export function requestId(req, _res, next) {
  req.requestId =
    req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8)
  next()
}

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(
      process.hrtime.bigint() - startedAt
    ) / 1e6
    logger.info('request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userId: req.user ? req.user.id : null,
    })
  })
  next()
}

export function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      throw new ApiError(401, 'Authentication required')
    }
    const payload = jwt.verify(token, req.app.locals.config.jwtSecret)
    if (!payload?.sub) {
      throw new ApiError(401, 'Invalid or expired token')
    }
    req.user = { id: payload.sub }
    next()
  } catch (err) {
    if (err instanceof ApiError) return next(err)
    // jwt.verify failures (expired, malformed, wrong signature)
    const apiErr = new ApiError(401, 'Invalid or expired token')
    return next(apiErr)
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' })
}

// Central error handler: always returns { error } JSON, never a stack trace.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500
  let message = 'Internal server error'

  if (err instanceof ApiError) {
    status = err.status
    message = err.message
  } else if (err.type === 'entity.too.large') {
    status = 413
    message = 'Request body too large'
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400
    message = 'Invalid JSON in request body'
  } else if (err.code === 'ECONNREFUSED') {
    status = 503
    message = 'Database unavailable'
  }

  const logFields = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user ? req.user.id : null,
    error: err.name,
    stack: err.stack,
  }
  if (status >= 500) {
    logger.error('request failed', logFields)
  } else {
    logger.warn('request rejected', logFields)
  }

  if (res.headersSent) return
  res.status(status).json({ error: message })
}