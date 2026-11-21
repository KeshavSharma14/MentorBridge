import { Router, type Response } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'

export const sessionRouter = Router()
sessionRouter.use(requireAuth)

function slotForDate(date: Date): string {
  const hour = date.getUTCHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

async function getAcceptedRequest(mentorshipId: string, requesterId: string) {
  const { data, error } = await supabaseAdmin
    .from('mentorship_requests')
    .select('*')
    .eq('id', mentorshipId)
    .eq('status', 'accepted')
    .maybeSingle()
  if (error) throw error
  if (!data || (data.student_id !== requesterId && data.mentor_id !== requesterId)) {
    return null
  }
  return data
}

function mutualAvailability(studentAvailability: Record<string, unknown>, mentorAvailability: Record<string, unknown>) {
  const mutual: Record<string, string[]> = {}
  for (const [day, studentSlots] of Object.entries(studentAvailability)) {
    const mentorSlots = mentorAvailability[day]
    if (!Array.isArray(studentSlots) || !Array.isArray(mentorSlots)) continue
    const overlap = studentSlots.filter(
      (slot) => typeof slot === 'string' && mentorSlots.includes(slot),
    )
    if (overlap.length) mutual[day] = overlap
  }
  return mutual
}

sessionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mentorshipId = typeof req.query.mentorship_id === 'string' ? req.query.mentorship_id : null

    let query = supabaseAdmin
      .from('sessions')
      .select('*')
      .or(`student_id.eq.${req.user!.id},mentor_id.eq.${req.user!.id}`)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true })
    if (mentorshipId) query = query.eq('mentorship_request_id', mentorshipId)

    const { data, error } = await query
    if (error) throw error

    let mutualAvailabilitySlots: Record<string, string[]> | undefined
    if (mentorshipId) {
      const request = await getAcceptedRequest(mentorshipId, req.user!.id)
      if (!request) {
        res.status(403).json({ error: 'This session requires an accepted mentorship' })
        return
      }
      const [{ data: studentProfile }, { data: mentorProfile }] = await Promise.all([
        supabaseAdmin.from('profiles').select('availability').eq('user_id', request.student_id).maybeSingle(),
        supabaseAdmin.from('profiles').select('availability').eq('user_id', request.mentor_id).maybeSingle(),
      ])
      mutualAvailabilitySlots = mutualAvailability(
        (studentProfile?.availability as Record<string, unknown>) ?? {},
        (mentorProfile?.availability as Record<string, unknown>) ?? {},
      )
    }

    res.json({ sessions: data ?? [], mutual_availability: mutualAvailabilitySlots ?? {} })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to list sessions' })
  }
})

sessionRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mentorshipId = typeof req.body.mentorship_id === 'string' ? req.body.mentorship_id : ''
    const startsAt = typeof req.body.starts_at === 'string' ? req.body.starts_at : ''
    const endsAt = typeof req.body.ends_at === 'string' ? req.body.ends_at : ''
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    const meetingLink = typeof req.body.meeting_link === 'string' ? req.body.meeting_link.trim() : null
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : null

    if (!mentorshipId || !startsAt || !endsAt) {
      res.status(400).json({ error: 'mentorship_id, starts_at, and ends_at are required' })
      return
    }

    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: 'A valid future start and end time is required' })
      return
    }
    if (start <= new Date()) {
      res.status(400).json({ error: 'Session start must be in the future' })
      return
    }

    const request = await getAcceptedRequest(mentorshipId, req.user!.id)
    if (!request) {
      res.status(403).json({ error: 'This session requires an accepted mentorship' })
      return
    }

    const [{ data: studentProfile, error: studentError }, { data: mentorProfile, error: mentorError }] =
      await Promise.all([
        supabaseAdmin.from('profiles').select('availability').eq('user_id', request.student_id).maybeSingle(),
        supabaseAdmin.from('profiles').select('availability').eq('user_id', request.mentor_id).maybeSingle(),
      ])
    if (studentError) throw studentError
    if (mentorError) throw mentorError

    const mutual = mutualAvailability(
      (studentProfile?.availability as Record<string, unknown>) ?? {},
      (mentorProfile?.availability as Record<string, unknown>) ?? {},
    )
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(start)
    if (!mutual[day]?.includes(slotForDate(start))) {
      res.status(400).json({
        error: 'The proposed time does not overlap both profiles weekly availability',
        mutual_availability: mutual,
      })
      return
    }

    const { data: existingSessions, error: overlapError } = await supabaseAdmin
      .from('sessions')
      .select('id,starts_at,ends_at')
      .eq('mentorship_request_id', mentorshipId)
      .neq('status', 'cancelled')
      .neq('status', 'completed')
    if (overlapError) throw overlapError

    const overlaps = (existingSessions ?? []).some((existing) => {
      const existingStart = new Date(existing.starts_at).getTime()
      const existingEnd = new Date(existing.ends_at).getTime()
      return start.getTime() < existingEnd && end.getTime() > existingStart
    })
    if (overlaps) {
      res.status(409).json({ error: 'This time overlaps an existing session' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        mentorship_request_id: mentorshipId,
        mentor_id: request.mentor_id,
        student_id: request.student_id,
        proposed_by: req.user!.id,
        title: title || 'Mentorship session',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        meeting_link: meetingLink,
        notes,
        status: 'proposed',
      })
      .select('*')
      .single()
    if (error) throw error

    res.status(201).json({ session: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to propose session' })
  }
})

sessionRouter.patch('/:id/confirm', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: session, error: findError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (findError) throw findError
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    if (session.student_id !== req.user!.id && session.mentor_id !== req.user!.id) {
      res.status(403).json({ error: 'You are not a participant in this session' })
      return
    }
    if (session.proposed_by === req.user!.id) {
      res.status(409).json({ error: 'The participant who did not propose the session must confirm it' })
      return
    }
    if (session.status !== 'proposed') {
      res.status(409).json({ error: 'Only proposed sessions can be confirmed' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .single()
    if (error) throw error

    res.json({ session: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to confirm session' })
  }
})
