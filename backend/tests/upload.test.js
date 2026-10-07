import request from 'supertest'
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { pool } from '../src/db.js'
import { createUploadPost } from '../src/s3.js'

vi.mock('../src/s3.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createUploadPost: vi.fn(async ({ bucket, userId, contentType }) => {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType]
      const key = `uploads/${userId}/00000000-0000-0000-0000-000000000000.${ext}`
      return {
        url: 'https://test-bucket.s3.test/',
        fields: {
          key,
          'Content-Type': contentType,
          'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
          bucket,
        },
        key,
      }
    }),
    createSignedGetUrl: vi.fn(async () => 'https://signed.test/x'),
    deleteObject: vi.fn(async () => undefined),
  }
})

const config = loadConfig()
const makeApp = () => createApp(config)

let app
let token
let userId

beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
  vi.clearAllMocks()
  app = makeApp()
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Uploader', email: 'up@example.com', password: 'password123' })
  token = res.body.token
  userId = res.body.user.id
})

afterAll(async () => {
  await pool.end()
})

async function uploadUrl(body) {
  return request(app)
    .post('/api/bugs/upload-url')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
}

describe('POST /api/bugs/upload-url', () => {
  it('rejects unsupported content types', async () => {
    for (const contentType of ['image/gif', 'text/plain', 'image/svg+xml', undefined]) {
      const res = await uploadUrl({ contentType, size: 100 })
      expect(res.status, contentType).toBe(400)
      expect(res.body.error).toMatch(/image\/jpeg|image\/png|image\/webp/)
    }
  })

  it('rejects out-of-range or non-integer sizes', async () => {
    const cases = [
      { size: 0 },
      { size: -5 },
      { size: 6 * 1024 * 1024 },
      { size: 1.5 },
      { size: 'big' },
      { size: undefined },
    ]
    for (const c of cases) {
      const res = await uploadUrl({ contentType: 'image/png', ...c })
      expect(res.status, JSON.stringify(c)).toBe(400)
      expect(res.body.error).toMatch(/5242880/)
    }
  })

  it('accepts valid requests and returns a post URL with a namespaced key', async () => {
    const res = await uploadUrl({ contentType: 'image/webp', size: 4096 })
    expect(res.status).toBe(200)
    expect(res.body.url).toBe('https://test-bucket.s3.test/')
    expect(res.body.key).toMatch(new RegExp(`^uploads/${userId}/[0-9a-f-]+\\.webp$`))
    expect(res.body.fields.key).toBe(res.body.key)
    expect(res.body.fields['Content-Type']).toBe('image/webp')

    expect(createUploadPost).toHaveBeenCalledWith(
      expect.objectContaining({ userId, contentType: 'image/webp' })
    )
  })

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/bugs/upload-url')
      .send({ contentType: 'image/png', size: 1 })
    expect(res.status).toBe(401)
  })
})