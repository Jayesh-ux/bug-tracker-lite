import { API_BASE, ApiError, getToken } from './client.js'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MiB, matches the backend contract
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only JPG, PNG and WebP files are supported.' }
  }
  if (file.size > MAX_SIZE) {
    return { error: `Screenshots must be 5 MB or less (this one is ${Math.ceil(file.size / 1024 / 1024)} MB).` }
  }
  if (file.size === 0) {
    return { error: 'The file is empty.' }
  }
  return { error: null }
}

export async function requestUploadUrl({ contentType, size }) {
  const token = getToken()
  let res
  try {
    res = await fetch(`${API_BASE}/bugs/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ contentType, size }),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, true)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      data.error || 'Could not prepare the upload. Try again.',
      res.status,
      res.status >= 500
    )
  }
  return data
}

export function uploadToS3({ url, fields, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.append(key, value)
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('The storage service rejected the upload. Please try again.'))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(form)
  })
}

/**
 * Full flow: request a signed (pre-signed POST) upload URL, stream the file to S3
 * with progress reporting, and resolve with the object key to save on the bug.
 * Returns null if no file was chosen.
 */
export async function uploadImage(file, onProgress) {
  if (!file) return null
  const { url, fields, key } = await requestUploadUrl({ contentType: file.type, size: file.size })
  await uploadToS3({ url, fields, key, file, onProgress })
  return key
}