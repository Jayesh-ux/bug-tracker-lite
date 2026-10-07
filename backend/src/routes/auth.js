import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { query } from '../db.js'
import { ApiError, asyncHandler } from '../middleware.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RATE_LIMIT_MSG =
  'Rate limit reached: too many attempts. Try again in a minute.'

// Fresh limiters per app instance so tests are isolated and the counters are
// never shared between the two routes.
function limiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 5, // 5 requests per minute per IP
    standardHeaders: 'draft-6',
    legacyHeaders: true,
    handler: (_req, res) => {
      res.status(429).json({ error: RATE_LIMIT_MSG })
    },
  })
}

function signToken(userId, config) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  })
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email }
}

export function createAuthRouter() {
  const router = Router()
  const signupLimiter = limiter()
  const loginLimiter = limiter()

  router.post(
    '/auth/signup',
    signupLimiter,
    asyncHandler(async (req, res) => {
    const body = req.body || {}

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (name.length < 2) {
      throw new ApiError(400, 'Name must be at least 2 characters')
    }
    if (!EMAIL_RE.test(email)) {
      throw new ApiError(400, 'A valid email is required')
    }
    if (password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters')
    }

    const hash = await bcrypt.hash(password, 10)
    let result
    try {
      result = await query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [name, email, hash]
      )
    } catch (err) {
      if (err.code === '23505') {
        throw new ApiError(409, 'Email already registered')
      }
      throw err
    }

    const user = publicUser(result.rows[0])
    const token = signToken(user.id, req.app.locals.config)
    res.status(201).json({ token, user })
  })
)

router.post(
  '/auth/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required')
    }

    const result = await query(
      'SELECT id, name, email, password FROM users WHERE email = $1',
      [email]
    )
    const row = result.rows[0]

    // Same generic error whether the email or the password is wrong, so a
    // caller cannot tell which one (no user enumeration).
    const passwordOk = row ? await bcrypt.compare(password, row.password) : false
    if (!row || !passwordOk) {
      throw new ApiError(401, 'Invalid email or password')
    }

    const user = publicUser(row)
    const token = signToken(user.id, req.app.locals.config)
    res.json({ token, user })
  })
)
  return router
}

export default createAuthRouter