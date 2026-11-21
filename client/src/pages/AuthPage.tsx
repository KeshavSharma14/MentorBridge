import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AuthPage() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') await signUp(email, password, fullName)
      else await signIn(email, password)
      navigate('/profile')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <a className="auth-runtime-url" href={appUrl} target="_blank" rel="noreferrer">
        App URL: {appUrl}
      </a>
      <div className="auth-tabs">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">Create account</button>
      </div>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Join MentorBridge'}</h1>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="full-name">Full name</label>
            <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
