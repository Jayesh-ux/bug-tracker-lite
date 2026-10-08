import request from 'supertest'
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { pool } from '../src/db.js'
import { deleteObject, createSignedGetUrl } from '../src/s3.js'

vi.mock('../src/s3.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createUploadPost: vi.fn(async () => ({
      url: 'https://test-bucket.s3.test/',
      fields: { key: 'x', policy: 'p' },
      key: 'x',
    })),
    createSignedGetUrl: vi.fn(async ({ key }) => `https://signed.test/${encodeURIComponent(key)}`),
    deleteObject: vi.fn(async () => undefined),
  }
})

const config = loadConfig()
const makeApp = () => createApp(config)

async function signupUser(app, email = 'a@example.com', name = 'Alice') {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, email, password: 'password123' })
  return res.body
}

let app
let tokenA
let userA
let tokenB
let userB

beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
  vi.clearAllMocks()
  app = makeApp()
  const a = await signupUser(app, 'alice@example.com', 'Alice')
  const b = await signupUser(app, 'bob@example.com', 'Bob')
  tokenA = a.token
  userA = a.user
  tokenB = b.token
  userB = b.user
})

afterAll(async () => {
  await pool.end()
})

async function createBug(token, body = {}) {
  return request(app)
    .post('/api/bugs')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'A bug',
      description: 'details',
      severity: 'low',
      ...body,
    })
}

const otherUsersKey =
  'uploads/00000000-0000-0000-0000-000000000000/someone-elses.png'

describe('POST /api/bugs', () => {
  it('creates a bug owned by the token user and never trusts user_id from the body', async () => {
    const res = await createBug(tokenA, {
      // Attempt to hijack ownership:
      userId: userB.id,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      title: 'A bug',
      description: 'details',
      severity: 'low',
      status: 'open',
      hasImage: false,
    })
    expect(res.body.userId).toBeUndefined()

    const bList = await request(app)
      .get('/api/bugs')
      .set('Authorization', `Bearer ${tokenB}`)
    expect(bList.body.length).toBe(0)
  })

  it('defaults status to open', async () => {
    const res = await createBug(tokenA)
    expect(res.body.status).toBe('open')
  })

  it('accepts a valid imageKey that belongs to the caller', async () => {
    const res = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/abc.png`,
    })
    expect(res.status).toBe(201)
    expect(res.body.hasImage).toBe(true)
    expect(res.body.imageUrl).toBe(`https://signed.test/uploads%2F${userA.id}%2Fabc.png`)
  })

  it('rejects validation violations with 400', async () => {
    const cases = [
      { title: '' },
      { title: undefined },
      { title: 'x'.repeat(201) },
      { title: 'ok', severity: 'urgent' },
      { title: 'ok', severity: 'low', status: 'done' },
      { title: 'ok', description: 'y'.repeat(5001) },
      { title: 'ok', imageKey: otherUsersKey },
      { title: 'ok', imageKey: '../escape.png' },
    ]
    for (const body of cases) {
      const res = await createBug(tokenA, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })
})

describe('GET /api/bugs', () => {
  it('returns only the caller bugs, newest first', async () => {
    await createBug(tokenA, { title: 'one' })
    await delay(2)
    await createBug(tokenA, { title: 'two' })
    await createBug(tokenB, { title: 'bobs' })

    const mine = await request(app).get('/api/bugs').set('Authorization', `Bearer ${tokenA}`)
    expect(mine.status).toBe(200)
    expect(mine.body.map((b) => b.title)).toEqual(['two', 'one'])

    const bobs = await request(app).get('/api/bugs').set('Authorization', `Bearer ${tokenB}`)
    expect(bobs.body.map((b) => b.title)).toEqual(['bobs'])
  })

  it('filters by status and rejects unknown status filters', async () => {
    const t = new Date().getTime()
    await createBug(tokenA, { title: 'open one' })
    await delay(3)
    await createBug(tokenA, { title: 'closed one', status: 'closed' })

    const open = await request(app)
      .get('/api/bugs?status=open')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(open.body.map((b) => b.title)).toEqual(['open one'])

    const bogus = await request(app)
      .get('/api/bugs?status=bogus')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(bogus.status).toBe(400)
    expect(bogus.body.error).toBeTruthy()
  })
})

describe('GET /api/bugs/:id', () => {
  it('enforces ownership in SQL: a non-owner sees an identical 404', async () => {
    const mine = await createBug(tokenA)
    const id = mine.body.id

    const ownerRes = await request(app)
      .get(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(ownerRes.status).toBe(200)

    const otherRes = await request(app)
      .get(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
    const missingRes = await request(app)
      .get(`/api/bugs/${'11111111-1111-4111-8111-111111111111'}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(otherRes.status).toBe(404)
    expect(otherRes.body).toEqual(missingRes.body)
    expect(otherRes.body.error).toBe('Bug not found')
  })

  it('rejects non-UUID ids with 404', async () => {
    const res = await request(app)
      .get('/api/bugs/not-a-uuid')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('adds a signed imageUrl for bugs with images', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/shot.png`,
    })
    const res = await request(app)
      .get(`/api/bugs/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.hasImage).toBe(true)
    expect(res.body.imageUrl).toBe('https://signed.test/uploads%2F' + userA.id + '%2Fshot.png')
    expect(createSignedGetUrl).toHaveBeenCalled()
  })
})

describe('PUT /api/bugs/:id', () => {
  it('partially updates only the sent fields', async () => {
    const created = await createBug(tokenA)
    const id = created.body.id

    const res = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'in-progress' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('in-progress')
    expect(res.body.title).toBe('A bug')
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.body.updatedAt).getTime() - 1000
    )
  })

  it('validates only the fields that are sent', async () => {
    const created = await createBug(tokenA)
    const id = created.body.id
    const bad = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ severity: 'urgent' })
    expect(bad.status).toBe(400)
  })

  it('removing the image (null) deletes the old S3 object', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/shot.png`,
    })
    const id = created.body.id
    const res = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ imageKey: null })

    expect(res.status).toBe(200)
    expect(res.body.hasImage).toBe(false)
    expect(res.body.imageKey).toBe(null)
    expect(deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: `uploads/${userA.id}/shot.png` })
    )
  })

  it('editing without touching the image does NOT delete the S3 object', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/kept.png`,
    })
    const id = created.body.id
    const res = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'closed' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('closed')
    expect(res.body.imageKey).toBe(`uploads/${userA.id}/kept.png`)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('saving the same image key again is a no-op and does not delete', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/kept.png`,
    })
    const id = created.body.id
    const res = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ imageKey: `uploads/${userA.id}/kept.png` })

    expect(res.status).toBe(200)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('replacing the image deletes the OLD object', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/old.png`,
    })
    const id = created.body.id
    const res = await request(app)
      .put(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ imageKey: `uploads/${userA.id}/new.png` })

    expect(res.status).toBe(200)
    expect(res.body.imageKey).toBe(`uploads/${userA.id}/new.png`)
    expect(deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: `uploads/${userA.id}/old.png` })
    )
  })

  it('rejects a foreign imageKey on update', async () => {
    const created = await createBug(tokenA)
    const res = await request(app)
      .put(`/api/bugs/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ imageKey: otherUsersKey })
    expect(res.status).toBe(400)
  })

  it('404 for a bug owned by someone else', async () => {
    const created = await createBug(tokenA)
    const res = await request(app)
      .put(`/api/bugs/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'closed' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Bug not found')
  })
})

describe('DELETE /api/bugs/:id', () => {
  it('deletes the bug and its S3 image', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/gone.png`,
    })
    const id = created.body.id

    const res = await request(app)
      .delete(`/api/bugs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Bug deleted' })
    expect(deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: `uploads/${userA.id}/gone.png` })
    )

    const list = await request(app).get('/api/bugs').set('Authorization', `Bearer ${tokenA}`)
    expect(list.body.length).toBe(0)
  })

  it('returns 404 for another users bug and does not delete the image', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/keep.png`,
    })
    const res = await request(app)
      .delete(`/api/bugs/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(404)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('does not fail when the S3 delete fails (logs a warning instead)', async () => {
    const created = await createBug(tokenA, {
      imageKey: `uploads/${userA.id}/unwritable.png`,
    })
    deleteObject.mockRejectedValueOnce(new Error('network down'))
    const res = await request(app)
      .delete(`/api/bugs/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
  })
})

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}