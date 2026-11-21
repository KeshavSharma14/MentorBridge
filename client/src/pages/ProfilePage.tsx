import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { profilesApi, type Profile } from '../lib/api'
import { TagEditor } from '../components/TagEditor'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function ProfilePage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'student' | 'mentor'>('student')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [shareContact, setShareContact] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void profilesApi.getMe()
      .then(({ profile }) => {
        setRole(profile.role)
        setHeadline(profile.headline || '')
        setBio(profile.bio || '')
        setSkills(profile.skills || [])
        setInterests(profile.interests || [])
        setGoals(profile.goals || [])
        setAvailability(profile.availability || {})
        setEmail(String(profile.contact_info?.email || ''))
        setPhone(String(profile.contact_info?.phone || ''))
        setLinkedin(String(profile.contact_info?.linkedin || ''))
        setShareContact(profile.share_contact)
      })
      .catch((err: Error) => {
        if (!err.message.includes('not found')) setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleSlot(day: string, slot: string) {
    setAvailability((current) => {
      const slots = current[day] || []
      const next = slots.includes(slot) ? slots.filter((item) => item !== slot) : [...slots, slot]
      return { ...current, [day]: next }
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await profilesApi.save({
        role,
        headline,
        bio,
        skills,
        interests,
        goals,
        availability,
        contact_info: { email, phone, linkedin },
        share_contact: shareContact,
      } as Partial<Profile>)
      setSuccess('Profile saved')
      navigate(role === 'student' ? '/student' : '/mentor')
    } catch (err: any) {
      setError(err.message || 'Unable to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-status">Loading profile...</div>

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Onboarding</span>
          <h1>Build your MentorBridge profile</h1>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}
      <form className="profile-form" onSubmit={save}>
        <section className="card">
          <h2>Choose your role</h2>
          <div className="role-grid">
            <button type="button" className={role === 'student' ? 'role-card active' : 'role-card'} onClick={() => setRole('student')}>
              <strong>Student</strong>
              <span>Find a mentor and grow your career.</span>
            </button>
            <button type="button" className={role === 'mentor' ? 'role-card active' : 'role-card'} onClick={() => setRole('mentor')}>
              <strong>Mentor</strong>
              <span>Share experience and guide students.</span>
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Profile</h2>
          <div className="field">
            <label htmlFor="headline">Headline</label>
            <input id="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="e.g. Computer Science student interested in AI" />
          </div>
          <div className="field">
            <label htmlFor="bio">Bio</label>
            <textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
          </div>
          <TagEditor label="Skills" values={skills} onChange={setSkills} placeholder="Add a skill and press Enter" />
          <TagEditor label="Interests" values={interests} onChange={setInterests} placeholder="Add an interest and press Enter" />
          <TagEditor label="Goals" values={goals} onChange={setGoals} placeholder="Add a goal and press Enter" />
        </section>

        <section className="card">
          <h2>Weekly availability</h2>
          <div className="availability-grid">
            {days.map((day) => (
              <div className="day-row" key={day}>
                <strong>{day}</strong>
                {['Morning', 'Afternoon', 'Evening'].map((slot) => (
                  <label key={slot}>
                    <input
                      type="checkbox"
                      checked={(availability[day] || []).includes(slot)}
                      onChange={() => toggleSlot(day, slot)}
                    />
                    {slot}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Private contact details</h2>
          <p className="muted">These fields are hidden unless a mentorship is accepted and sharing is enabled.</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="linkedin">LinkedIn</label>
              <input id="linkedin" value={linkedin} onChange={(event) => setLinkedin(event.target.value)} />
            </div>
          </div>
          <label className="toggle-row">
            <span>
              <strong>Share contact details</strong>
              <small>Only visible to accepted mentorship partners</small>
            </span>
            <input type="checkbox" checked={shareContact} onChange={(event) => setShareContact(event.target.checked)} />
          </label>
        </section>

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}
