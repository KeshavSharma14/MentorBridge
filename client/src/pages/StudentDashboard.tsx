import { useEffect, useState } from 'react'
import { profilesApi, mentorshipsApi, type Profile, type Mentorship } from '../lib/api'
import { PrivacyToggle } from '../components/PrivacyToggle'
import { RecommendationsFeed } from '../components/RecommendationsFeed'
import { ChatWindow } from '../components/ChatWindow'
import { SessionScheduler } from '../components/SessionScheduler'
import { useAuth } from '../context/AuthContext'

export function StudentDashboard() {
  const { user } = useAuth()
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [mentorshipResult, profileResult] = await Promise.all([
        mentorshipsApi.getAll(),
        profilesApi.getMe(),
      ])
      setMentorships(mentorshipResult.mentorships)
      setProfile(profileResult.profile)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => { void load() }, [])

  const pending = mentorships.filter((item) => item.status === 'pending')
  const active = mentorships.filter((item) => item.status === 'accepted')

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Student portal</span>
          <h1>Find your mentor</h1>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      {profile && <PrivacyToggle initial={profile.share_contact} />}

      <RecommendationsFeed role="student" />

      <section className="dashboard-section">
        <h2>Requests & active mentorships</h2>
        <div className="request-list">
          {[...pending, ...active].map((item) => (
            <article className="request-row" key={item.id}>
              <div>
                <strong>{item.mentor?.full_name || 'Mentor'}</strong>
                {item.message && <p>{item.message}</p>}
              </div>
              <span className={`status status-${item.status}`}>{item.status}</span>
            </article>
          ))}
          {!pending.length && !active.length && <p className="muted">No mentorship requests yet.</p>}
        </div>
      </section>

      {active.map((mentorship) => (
        <section className="connected-tools" key={mentorship.id}>
          <ChatWindow mentorshipId={mentorship.id} recipientName={mentorship.mentor?.full_name || 'Mentor'} />
          <SessionScheduler
            mentorshipId={mentorship.id}
            currentUserId={user?.id || ''}
            recipientName={mentorship.mentor?.full_name || 'Mentor'}
          />
        </section>
      ))}
    </div>
  )
}
