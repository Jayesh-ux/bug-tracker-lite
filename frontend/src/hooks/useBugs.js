import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

export function useBugs() {
  const [bugs, setBugs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBugs(await api.get('/bugs'))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { bugs, loading, error, reload }
}