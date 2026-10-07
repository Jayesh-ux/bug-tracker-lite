import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

export function useBug(id) {
  const [bug, setBug] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((a) => a + 1), [])

  // Silent background refetch: used to mint a fresh pre-signed imageUrl when
  // the previous one expires, WITHOUT toggling `loading` (which would unmount
  // an open form and discard the user's in-progress edits).
  const refresh = useCallback(async () => {
    try {
      const b = await api.get(`/bugs/${id}`)
      setBug(b)
    } catch {
      /* keep showing the current bug; the next expiry retries */
    }
  }, [id])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api
      .get(`/bugs/${id}`)
      .then((b) => alive && setBug(b))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id, attempt])

  return { bug, loading, error, reload, refresh }
}