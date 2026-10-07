import request from 'supertest'
import jwt from 'jsonwebtoken'
import { beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { pool } from '../src/db.js'

const config = loadConfig()

// Each test gets a fresh app instance -> fresh in-memory rate limiter.
const makeApp = () => createApp(config)

async function signup(app, body) {
  return request(app).post('/api/auth/signup').send(body)
}

beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
})

afterAll(async () => {
  await pool.end()
})

describe('POST /api/auth/signup', () => {
  it('creates a user, lowercases the email, returns token + user (201)', async () => {
    const app = makeApp()
    const res = await signup(app, {
      name: 'Alice Wang',
      email: '  Alice@Example.COM ',
      password: 'password123',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user).toMatchObject({
      name: 'Alice Wang',
      email: 'alice@example.com',
    })
    expect(res.body.user).toHaveProperty('id')
    expect(res.body.user).not.toHaveProperty('password')

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
    expect(login.status).toBe(200)
  })

  it('rejects a duplicate email with 409', async () => {
    const app = makeApp()
    const body = { name: 'Alice Wang', email: 'a@example.com', password: 'password123' }
    await signup(app, body)
    const dup = await signup(app, { ...body, name: 'Alice 2' })
    expect(dup.status).toBe(409)
    expect(dup.body).toEqual({ error: 'Email already registered' })
  })

  it('rejects invalid input with 400', async () => {
    const app = makeApp()
    const cases = [
      { name: 'A', email: 'a@example.com', password: 'password123' },
      { name: 'Alice', email: 'not-an-email', password: 'password123' },
      { name: 'Alice', email: 'a@example.com', password: 'short' },
      { name: '', email: 'a@example.com', password: 'password123' },
    ]
    for (const c of cases) {
      const res = await signup(app, c)
      expect(res.status).toBe(400)
      expect(res.body.error).toBeTruthy()
    }
  })
})

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const app = makeApp()
    await signup(app, { name: 'Bob', email: 'bob@example.com', password: 'password123' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe('bob@example.com')
  })

  it('returns the exact same generic 401 for wrong password OR unknown email', async () => {
    const app = makeApp()
    await signup(app, { name: 'Bob', email: 'bob@example.com', password: 'password123' })

    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'wrong' })
    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' })

    expect(wrongPass.status).toBe(401)
    expect(wrongEmail.status).toBe(401)
    expect(wrongPass.body).toEqual(wrongEmail.body)
    expect(wrongPass.body.error).toBe('Invalid email or password')
  })

  it('missing email/password -> 400', async () => {
    const app = makeApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.z' })
    expect(res.status).toBe(400)
  })
})

describe('Rate limiting (auth, 5/min/IP)', () => {
  it('returns 429 with RateLimit headers on the 6th request in a minute', async () => {
    const app = makeApp()
    const body = { email: 'nobody@example.com', password: 'password123' }
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send(body)
      expect(res.status).not.toBe(429)
    }
    const blocked = await request(app).post('/api/auth/login').send(body)
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toBe(
      'Rate limit reached: too many attempts. Try again in a minute.'
    )
    expect(blocked.headers['ratelimit-limit']).toBe('5')
    expect(blocked.headers['ratelimit-remaining']).toBe('0')
    expect(blocked.headers['retry-after']).toBeTruthy()
  })

  it('rate limits signup independently of login', async () => {
    const app = makeApp()
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: `User ${i}`, email: `u${i}@example.com`, password: 'password123' })
    }
    const blocked = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'One more', email: 'extra@example.com', password: 'password123' })
    expect(blocked.status).toBe(429)
    // login limiter is a separate counter, still usable
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u0@example.com', password: 'password123' })
    expect(login.status).toBe(200)
  })
})

describe('Token enforcement', () => {
  it('rejects requests without a token', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/bugs')
    expect(res.status).toBe(401)
    expect(res.body.error).toBeTruthy()
  })

  it('rejects garbage and tampered tokens', async () => {
    const app = makeApp()
    for (const token of ['garbage', 'a.b.c', 'Bearer ']) {
      const res = await request(app)
        .get('/api/bugs')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(401)
    }
  })

  it('rejects an expired token', async () => {
    const app = makeApp()
    const expired = jwt.sign({ sub: '00000000-0000-0000-0000-000000000001' }, config.jwtSecret, {
      expiresIn: -10,
    })
    const res = await request(app)
      .get('/api/bugs')
      .set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
  })
})

describe('Health + misc', () => {
  it('GET /api/health returns ok', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.db).toBe('up')
  })

  it('unknown routes return a JSON 404', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('error responses never leak a stack trace', async () => {
    const app = makeApp()
    const me = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Sam', email: 'sam@example.com', password: 'password123' })
    const res = await request(app)
      .get('/api/bugs/not-a-uuid')
      .set('Authorization', `Bearer ${me.body.token}`)
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('Stack')
    expect(JSON.stringify(res.body)).not.toContain('node_modules')
    expect(res.body.error).toBe('Bug not found')
  })
})