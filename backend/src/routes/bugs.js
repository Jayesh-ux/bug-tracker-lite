import crypto from 'node:crypto'
import { Router } from 'express'
import { query } from '../db.js'
import {
  ApiError,
  asyncHandler,
  requireAuth,
  isValidUUID,
} from '../middleware.js'
import { logger } from '../logger.js'
import {
  createUploadPost,
  createSignedGetUrl,
  deleteObject,
  isOwnImageKey,
} from '../s3.js'

const router = Router()

const SEVERITIES = ['low', 'med', 'high']
const STATUSES = ['open', 'in-progress', 'closed']
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const BUG_COLUMNS =
  'id, title, description, severity, status, image_key, created_at, updated_at'

// snake_case DB rows -> camelCase API payloads
function serialize(bug, extra = {}) {
  return {
    id: bug.id,
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    status: bug.status,
    imageKey: bug.image_key,
    hasImage: !!bug.image_key,
    imageUrl: bug.imageUrl || null,
    createdAt: bug.created_at,
    updatedAt: bug.updated_at,
    ...extra,
  }
}

function validateTitle(role = 'title') {
  return (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ApiError(400, `${role} is required`)
    }
    const trimmed = value.trim()
    if (trimmed.length > 200) {
      throw new ApiError(400, `${role} must be 200 characters or fewer`)
    }
    return trimmed
  }
}

function validateDescription(value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'description must be a string')
  }
  if (value.length > 5000) {
    throw new ApiError(400, 'description must be 5000 characters or fewer')
  }
  return value
}

function validateSeverity(value) {
  if (!SEVERITIES.includes(value)) {
    throw new ApiError(
      400,
      `severity must be one of: ${SEVERITIES.join(', ')}`
    )
  }
  return value
}

function validateStatus(value) {
  if (!STATUSES.includes(value)) {
    throw new ApiError(
      400,
      `status must be one of: ${STATUSES.join(', ')}`
    )
  }
  return value
}

// imageKey is always validated against the *caller's* user id so a user can
// never attach or delete someone else's object.
function validateImageKey(value, userId) {
  if (value === null || value === undefined || value === '') return null
  if (!isOwnImageKey(value, userId)) {
    throw new ApiError(
      400,
      'imageKey must belong to the signed-in user uploads area'
    )
  }
  return value
}

// POST /bugs
router.post(
  '/bugs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const userId = req.user.id

    const title = validateTitle('title')(body.title)
    const description =
      body.description === undefined
        ? ''
        : validateDescription(body.description ?? '')
    const severity = validateSeverity(body.severity)
    const status = body.status === undefined ? 'open' : validateStatus(body.status)
    const imageKey =
      body.imageKey === undefined ? null : validateImageKey(body.imageKey, userId)

    const result = await query(
      `INSERT INTO bugs (user_id, title, description, severity, status, image_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${BUG_COLUMNS}`,
      [userId, title, description, severity, status, imageKey]
    )

    const bug = serialize(result.rows[0])
    if (bug.imageKey) {
      bug.imageUrl = await createSignedGetUrl({
        region: req.app.locals.config.awsRegion,
        bucket: req.app.locals.config.s3Bucket,
        key: bug.imageKey,
      })
    }
    res.status(201).json(bug)
  })
)

// POST /bugs/upload-url (must be registered before /bugs/:id)
router.post(
  '/bugs/upload-url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const { contentType, size } = body
    const userId = req.user.id

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ApiError(
        400,
        'contentType must be one of: image/jpeg, image/png, image/webp'
      )
    }
    if (!Number.isInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        400,
        'size must be an integer between 1 and 5242880 bytes (5 MB)'
      )
    }

    const config = req.app.locals.config
    if (!config.s3Bucket) {
      throw new ApiError(
        500,
        'S3 bucket is not configured on the server'
      )
    }

    const { url, fields, key } = await createUploadPost({
      region: config.awsRegion,
      bucket: config.s3Bucket,
      userId,
      contentType,
    })

    res.json({ url, fields, key })
  })
)

// GET /bugs?status=open|in-progress|closed
router.get(
  '/bugs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { status } = req.query
    if (status !== undefined && !STATUSES.includes(status)) {
      throw new ApiError(
        400,
        `status must be one of: ${STATUSES.join(', ')}`
      )
    }

    const params = [userId]
    let sql = `SELECT ${BUG_COLUMNS} FROM bugs WHERE user_id = $1`
    if (status !== undefined) {
      params.push(status)
      sql += ` AND status = $${params.length}`
    }
    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)
    res.json(result.rows.map((r) => serialize(r)))
  })
)

// GET /bugs/:id — ownership enforced inside the SQL; identical 404 for
// "does not exist" and "belongs to someone else" so IDs cannot be probed.
router.get(
  '/bugs/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!isValidUUID(id)) {
      throw new ApiError(404, 'Bug not found')
    }
    const result = await query(
      `SELECT ${BUG_COLUMNS} FROM bugs WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    )
    if (!result.rows.length) {
      throw new ApiError(404, 'Bug not found')
    }

    const bug = serialize(result.rows[0])
    if (bug.imageKey) {
      bug.imageUrl = await createSignedGetUrl({
        region: req.app.locals.config.awsRegion,
        bucket: req.app.locals.config.s3Bucket,
        key: bug.imageKey,
      })
    }
    res.json(bug)
  })
)

// PUT /bugs/:id — partial update; only the fields that are sent are validated.
router.put(
  '/bugs/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!isValidUUID(id)) {
      throw new ApiError(404, 'Bug not found')
    }
    const userId = req.user.id
    const body = req.body || {}

    // Load the current row first (ownership check) so we know the old image.
    const existing = await query(
      'SELECT id, image_key FROM bugs WHERE id = $1 AND user_id = $2',
      [id, userId]
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'Bug not found')
    }
    const oldImageKey = existing.rows[0].image_key

    const updates = []
    const params = []
    const addUpdate = (column, value) => {
      params.push(value)
      updates.push(`${column} = $${params.length}`)
    }

    if (body.title !== undefined) addUpdate('title', validateTitle('title')(body.title))
    if (body.description !== undefined) {
      addUpdate('description', validateDescription(body.description ?? ''))
    }
    if (body.severity !== undefined) addUpdate('severity', validateSeverity(body.severity))
    if (body.status !== undefined) addUpdate('status', validateStatus(body.status))
    if (body.imageKey !== undefined) {
      const newKey = validateImageKey(body.imageKey, userId)
      if (newKey !== oldImageKey) {
        addUpdate('image_key', newKey)
      } else {
        // no-op: keep it out of the SET clause
      }
    }

    if (!updates.length) {
      // Nothing to change: return the bug untouched.
      const fresh = await query(
        `SELECT ${BUG_COLUMNS} FROM bugs WHERE id = $1 AND user_id = $2`,
        [id, userId]
      )
      return res.json(serialize(fresh.rows[0]))
    }

    updates.push('updated_at = now()')
    const result = await query(
      `UPDATE bugs SET ${updates.join(', ')}
       WHERE id = $${params.length + 1} AND user_id = $${params.length + 2}
       RETURNING ${BUG_COLUMNS}`,
      [...params, id, userId]
    )

    // If the image changed, delete the old object. Never fail the request on
    // a delete failure — just log a warning (the DB no longer references it).
    if (oldImageKey && body.imageKey !== undefined && oldImageKey !== body.imageKey) {
      try {
        await deleteObject({
          region: req.app.locals.config.awsRegion,
          bucket: req.app.locals.config.s3Bucket,
          key: oldImageKey,
        })
        logger.info('bug image deleted on update', {
          bugId: id,
          key: oldImageKey,
          userId,
        })
      } catch (err) {
        logger.warn('failed to delete old bug image on update', {
          bugId: id,
          key: oldImageKey,
          userId,
          error: err.message,
        })
      }
    }

    const bug = serialize(result.rows[0])
    if (bug.imageKey) {
      bug.imageUrl = await createSignedGetUrl({
        region: req.app.locals.config.awsRegion,
        bucket: req.app.locals.config.s3Bucket,
        key: bug.imageKey,
      })
    }
    res.json(bug)
  })
)

// DELETE /bugs/:id — ownership enforced; deletes the S3 object afterwards.
router.delete(
  '/bugs/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!isValidUUID(id)) {
      throw new ApiError(404, 'Bug not found')
    }
    const userId = req.user.id

    const result = await query(
      `DELETE FROM bugs WHERE id = $1 AND user_id = $2 RETURNING image_key`,
      [id, userId]
    )
    if (!result.rows.length) {
      throw new ApiError(404, 'Bug not found')
    }

    const { image_key: imageKey } = result.rows[0]
    if (imageKey) {
      try {
        await deleteObject({
          region: req.app.locals.config.awsRegion,
          bucket: req.app.locals.config.s3Bucket,
          key: imageKey,
        })
        logger.info('bug image deleted', { bugId: id, key: imageKey, userId })
      } catch (err) {
        logger.warn('failed to delete bug image', {
          bugId: id,
          key: imageKey,
          userId,
          error: err.message,
        })
      }
    }

    res.json({ message: 'Bug deleted' })
  })
)

export default router