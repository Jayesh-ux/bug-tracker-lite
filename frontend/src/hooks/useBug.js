import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

export function useBug(id) {
  const [bug, setBug] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((a) => a + 1), [])

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

  return { bug, loading, error, reload }
}