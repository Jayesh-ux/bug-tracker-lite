import crypto from 'node:crypto'
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Credentials come from the AWS SDK default provider chain ONLY:
//   - local: your `aws configure` profile (~/.aws/credentials or env vars)
//   - EC2:   the instance IAM role
// Nothing is hardcoded here.

let client = null

function s3(region) {
  if (!client) client = new S3Client({ region })
  return client
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const ALLOWED_CONTENT_TYPES = Object.keys(EXTENSIONS)

export function extForContentType(contentType) {
  return EXTENSIONS[contentType] || null
}

// POST /bugs/upload-url -> returns S3 POST policy the browser POSTs to.
export async function createUploadPost({ region, bucket, userId, contentType }) {
  const key = `uploads/${userId}/${crypto.randomUUID()}${EXTENSIONS[contentType]}`
  const { url, fields } = await createPresignedPost(
    s3(region),
    {
      Bucket: bucket,
      Key: key,
      // S3 enforces the 5 MB limit and the content type in the policy, even if
      // someone bypasses the frontend and hits the URL directly.
      Conditions: [
        ['content-length-range', 1, MAX_SIZE],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 300,
    }
  )
  return { url, fields, key }
}

// Short-lived GET URL for viewing an image (5 minutes).
export async function createSignedGetUrl({ region, bucket, key }) {
  return getSignedUrl(
    s3(region),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 }
  )
}

export async function deleteObject({ region, bucket, key }) {
  await s3(region).send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  )
}

// Only a user's own uploads/... keys may be attached to / removed from a bug.
export function isOwnImageKey(key, userId) {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.startsWith(`uploads/${userId}/`) &&
    !key.includes('..')
  )
}