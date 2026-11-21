import { useEffect, useState, type FormEvent } from 'react'
import { sessionsApi, type MentorshipSession } from '../lib/api'

interface SessionSchedulerProps {
  mentorshipId: string
  currentUserId: string
  recipientName: string
}

export function SessionScheduler({ mentorshipId, currentUserId, recipientName }: SessionSchedulerProps) {
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [mutualAvailability, setMutualAvailability] = useState<Record<string, string[]>>({})
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [agenda, setAgenda] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    try {
      const result = await sessionsApi.list(mentorshipId)
      setSessions(result.sessions)
      setMutualAvailability(result.mutual_availability)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => { void load() }, [mentorshipId])

  async function propose(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!date || !time) {
      setError('Choose a date and time')
      return
    }
    try {
      const start = new Date(`${date}T${time}:00`)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      await sessionsApi.propose({
        mentorship_id: mentorshipId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        title,
        meeting_link: meetingLink,
        notes: agenda,
      })
      await load()
      setDate('')
      setTime('')
      setTitle('')
      setMeetingLink('')
      setAgenda('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function confirm(id: string) {
    setBusyId(id)
    setError('')
    try {
      await sessionsApi.confirm(id)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  const upcoming = sessions
    .filter((session) => new Date(session.starts_at).getTime() >= Date.now())
    .filter((session) => session.status !== 'cancelled')
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at))

  const slotTimes: Record<string, string> = {
    Morning: '09:00',
    Afternoon: '14:00',
    Evening: '18:00',
  }

  const selectedDay = date
    ? new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
    : ''
  const availableTimes = selectedDay ? mutualAvailability[selectedDay] ?? [] : []
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minimumDate = tomorrow.toISOString().slice(0, 10)

  return (
    <section className="scheduler">
      <h2>Schedule with {recipientName}</h2>
      {error && <div className="alert error">{error}</div>}
      <div className="mutual-slots">
        <small>Mutual availability</small>
        {Object.entries(mutualAvailability).map(([day, slots]) => (
          <span className="tag" key={day}>{day}: {slots.join(', ')}</span>
        ))}
        {!Object.keys(mutualAvailability).length && <p className="muted">No overlapping weekly slots found.</p>}
      </div>
      <form className="scheduler-form" onSubmit={propose}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="session-date">Date</label>
            <input
              id="session-date"
              type="date"
              min={minimumDate}
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setTime('')
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="session-time">Time</label>
            <select
              id="session-time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!availableTimes.length}
              required
            >
              <option value="">Select a mutual slot</option>
              {availableTimes.map((slot) => (
                <option value={slotTimes[slot] || ''} key={slot}>
                  {slot} ({slotTimes[slot]})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="session-title">Agenda title</label>
            <input id="session-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Career review" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="session-link">Meeting link</label>
          <input id="session-link" type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://..." />
        </div>
        <div className="field">
          <label htmlFor="session-agenda">Agenda / notes</label>
          <textarea id="session-agenda" rows={3} value={agenda} onChange={(event) => setAgenda(event.target.value)} />
        </div>
        <button className="primary-button" type="submit">Propose session</button>
      </form>

      <div className="upcoming-sessions">
        <h3>Upcoming sessions</h3>
        {upcoming.map((session) => (
          <article className="session-row" key={session.id}>
            <div>
              <strong>{session.title}</strong>
              <p>{new Date(session.starts_at).toLocaleString()} – {new Date(session.ends_at).toLocaleTimeString()}</p>
              {session.meeting_link && <a href={session.meeting_link} target="_blank" rel="noreferrer">Meeting link</a>}
            </div>
            <div>
              <span className={`status status-${session.status}`}>{session.status}</span>
              {session.status === 'proposed' && session.proposed_by !== currentUserId && (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === session.id}
                  onClick={() => void confirm(session.id)}
                >
                  Confirm
                </button>
              )}
            </div>
          </article>
        ))}
        {!upcoming.length && <p className="muted">No upcoming sessions.</p>}
      </div>
    </section>
  )
}
