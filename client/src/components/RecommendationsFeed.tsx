import { useEffect, useState } from 'react'
import {
  mentorshipsApi,
  profilesApi,
  type Profile,
  type Recommendation,
} from '../lib/api'

interface RecommendationsFeedProps {
  role: 'student' | 'mentor'
  title?: string
}

export function RecommendationsFeed({ role, title }: RecommendationsFeedProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Profile | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void Promise.all([
      profilesApi.getRecommendations(),
      mentorshipsApi.getAll(),
    ])
      .then(([recommendationResult, mentorshipResult]) => {
        setRecommendations(recommendationResult.recommendations)
        setRequestedIds(new Set(
          mentorshipResult.mentorships
            .filter((mentorship) => mentorship.student_id !== mentorship.mentor_id)
            .filter((mentorship) => mentorship.status !== 'rejected')
            .map((mentorship) => role === 'student' ? mentorship.mentor_id : mentorship.student_id),
        ))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [role])

  useEffect(() => {
    if (!selected) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selected])

  async function sendRequest() {
    if (!selected) return
    setSending(true)
    setError('')
    try {
      await mentorshipsApi.send(selected.user_id, message.trim() || undefined)
      setRequestedIds((current) => new Set([...current, selected.user_id]))
      setSelected(null)
      setMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="page-status">Finding recommendations...</div>

  return (
    <section className="dashboard-section">
      <h2>{title || (role === 'student' ? 'Recommended mentors' : 'Recommended students')}</h2>
      {error && <div className="alert error">{error}</div>}
      <div className="profile-grid">
        {recommendations.map((recommendation) => {
          const profile = recommendation.profile
          const name = profile.users?.full_name || profile.headline || (role === 'student' ? 'Mentor' : 'Student')
          const alreadyRequested = requestedIds.has(profile.user_id)

          return (
            <article className="recommendation-card" key={profile.user_id}>
              <div className="match-heading">
                <div>
                  <h3>{name}</h3>
                  {profile.headline && <p className="headline">{profile.headline}</p>}
                </div>
                <span className="match-badge" aria-label={`${recommendation.score}% match`}>
                  {recommendation.score}% match
                </span>
              </div>
              {profile.bio && <p className="recommendation-bio">{profile.bio}</p>}
              {recommendation.sharedSkills.length > 0 && (
                <div>
                  <small className="tag-label">Shared skills</small>
                  <div className="tag-list">
                    {recommendation.sharedSkills.map((skill) => (
                      <span className="shared-tag" key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>
              )}
              {role === 'student' ? (
                alreadyRequested ? (
                  <span className="status status-pending">Request sent</span>
                ) : (
                  <button className="primary-button" type="button" onClick={() => setSelected(profile)}>
                    Request Mentorship
                  </button>
                )
              ) : (
                <span className="status status-accepted">Potential match</span>
              )}
            </article>
          )
        })}
        {!recommendations.length && (
          <p className="muted">No recommendations yet. Complete your profile and add skills, interests, goals, and availability.</p>
        )}
      </div>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="request-modal-title">Request mentorship</h2>
            <p>
              Send a request to <strong>{selected.users?.full_name || selected.headline || 'this mentor'}</strong>.
            </p>
            <div className="field">
              <label htmlFor="mentorship-message">Introduction</label>
              <textarea
                id="mentorship-message"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share what you want guidance with..."
              />
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" disabled={sending} onClick={() => void sendRequest()}>
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
