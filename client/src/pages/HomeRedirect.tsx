import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { profilesApi } from '../lib/api'

export function HomeRedirect() {
  const [destination, setDestination] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void profilesApi.getMe()
      .then(({ profile }) => setDestination(profile.role === 'mentor' ? '/mentor' : '/student'))
      .catch((err: Error) => {
        if (err.message.includes('not found')) setDestination('/profile')
        else setError(err.message)
      })
  }, [])

  if (error) return <div className="alert error page-status">{error}</div>
  if (!destination) return <div className="page-status">Loading dashboard...</div>
  return <Navigate to={destination} replace />
}
