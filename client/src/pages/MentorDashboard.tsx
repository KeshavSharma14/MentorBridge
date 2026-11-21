import { useEffect, useState } from 'react'
import { profilesApi, mentorshipsApi, type Mentorship, type Profile } from '../lib/api'
import { PrivacyToggle } from '../components/PrivacyToggle'
import { RecommendationsFeed } from '../components/RecommendationsFeed'
import { ChatWindow } from '../components/ChatWindow'
import { SessionScheduler } from '../components/SessionScheduler'
import { useAuth } from '../context/AuthContext'

export function MentorDashboard() {
  const { user } = useAuth()
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    try {
      const [result, profileResult] = await Promise.all([mentorshipsApi.getAll(), profilesApi.getMe()])
      setMentorships(result.mentorships)
      setProfile(profileResult.profile)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => { void load() }, [])

  async function respond(id: string, status: 'accepted' | 'rejected') {
    setBusyId(id)
    setError('')
    try {
      await mentorshipsApi.respond(id, status)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  const pending = mentorships.filter((item) => item.status === 'pending')
  const active = mentorships.filter((item) => item.status === 'accepted')
  const rejected = mentorships.filter((item) => item.status === 'rejected')

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Mentor portal</span>
          <h1>Mentorship requests</h1>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {profile && <PrivacyToggle initial={profile.share_contact} />}

      <RecommendationsFeed role="mentor" title="Students seeking guidance" />

      <section className="dashboard-section">
        <h2>Pending review</h2>
        <div className="request-list">
          {pending.map((item) => (
            <article className="request-row request-actions" key={item.id}>
              <div>
                <strong>{item.student?.full_name || 'Student'}</strong>
                {item.message && <p>{item.message}</p>}
              </div>
              <div className="button-group">
                <button className="secondary-button" type="button" disabled={busyId === item.id} onClick={() => void respond(item.id, 'rejected')}>Reject</button>
                <button className="primary-button" type="button" disabled={busyId === item.id} onClick={() => void respond(item.id, 'accepted')}>Accept</button>
              </div>
            </article>
          ))}
          {!pending.length && <p className="muted">No pending requests.</p>}
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Active mentorships</h2>
        <div className="profile-grid">
          {active.map((item) => (
            <article className="mentor-card" key={item.id}>
              <h3>{item.student?.full_name || 'Student'}</h3>
              <p>{item.message || 'Active mentorship'}</p>
              <span className="status status-accepted">accepted</span>
            </article>
          ))}
          {!active.length && <p className="muted">No active mentorships.</p>}
        </div>
      </section>

      {rejected.length > 0 && (
        <section className="dashboard-section">
          <h2>Reviewed requests</h2>
          {rejected.map((item) => (
            <div className="request-row" key={item.id}>
              <strong>{item.student?.full_name || 'Student'}</strong>
              <span className="status status-rejected">rejected</span>
            </div>
          ))}
        </section>
      )}

      {active.map((mentorship) => (
        <section className="connected-tools" key={mentorship.id}>
          <ChatWindow mentorshipId={mentorship.id} recipientName={mentorship.student?.full_name || 'Student'} />
          <SessionScheduler
            mentorshipId={mentorship.id}
            currentUserId={user?.id || ''}
            recipientName={mentorship.student?.full_name || 'Student'}
          />
        </section>
      ))}
    </div>
  )
}
