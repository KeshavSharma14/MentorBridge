import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout() {
  const { signOut, user } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">MentorBridge</Link>
        <nav>
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
