import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthPage } from './pages/AuthPage'
import { ProfilePage } from './pages/ProfilePage'
import { StudentDashboard } from './pages/StudentDashboard'
import { MentorDashboard } from './pages/MentorDashboard'
import { HomeRedirect } from './pages/HomeRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/mentor" element={<MentorDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
