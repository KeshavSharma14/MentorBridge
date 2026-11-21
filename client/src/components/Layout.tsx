import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout() {
  const { signOut, user } = useAuth()
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">MentorBridge</Link>
        <nav>
          <a className="runtime-url" href={appUrl} target="_blank" rel="noreferrer" title="Open the MentorBridge app">
            {appUrl.replace(/^https?:\/\//, '')}
          </a>
          <Link to="/profile">Profile</Link>
          {user && (
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main><Outlet /></main>
    </div>
  )
}
