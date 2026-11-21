import { Router, type Response } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'

export const mentorshipRouter = Router()
mentorshipRouter.use(requireAuth)

function sanitizeMentorship(mentorship: Record<string, any>) {
  const sanitized = { ...mentorship }
  for (const key of ['student', 'mentor'] as const) {
    if (sanitized[key]) {
      sanitized[key] = { ...sanitized[key] }
      delete sanitized[key].email
    }
  }
  return sanitized
}

mentorshipRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('mentorship_requests')
      .select(`
        *,
        student:student_id(id,email,full_name),
        mentor:mentor_id(id,email,full_name)
      `)
      .or(`student_id.eq.${req.user!.id},mentor_id.eq.${req.user!.id}`)
      .order('created_at', { ascending: false })
    if (error) throw error

    res.json({ mentorships: (data ?? []).map(sanitizeMentorship) })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to load mentorship requests' })
  }
})

mentorshipRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mentorId = typeof req.body.mentor_id === 'string' ? req.body.mentor_id : ''
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : null
    if (!mentorId) {
      res.status(400).json({ error: 'mentor_id is required' })
      return
    }
    if (mentorId === req.user!.id) {
      res.status(400).json({ error: 'You cannot request mentorship from yourself' })
      return
    }

    const [{ data: studentProfile, error: studentError }, { data: mentorProfile, error: mentorError }] =
      await Promise.all([
        supabaseAdmin.from('profiles').select('role').eq('user_id', req.user!.id).maybeSingle(),
        supabaseAdmin.from('profiles').select('role').eq('user_id', mentorId).maybeSingle(),
      ])

    if (studentError) throw studentError
    if (mentorError) throw mentorError
    if (studentProfile?.role !== 'student') {
      res.status(403).json({ error: 'Only students can send mentorship requests' })
      return
    }
    if (mentorProfile?.role !== 'mentor') {
      res.status(400).json({ error: 'Selected user is not a mentor' })
      return
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('mentorship_requests')
      .select('id,status')
      .eq('student_id', req.user!.id)
      .eq('mentor_id', mentorId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      res.status(409).json({ error: 'A mentorship request already exists with this mentor', status: existing.status })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('mentorship_requests')
      .upsert(
        {
          student_id: req.user!.id,
          mentor_id: mentorId,
          status: 'pending',
          message,
          responded_at: null,
        },
        { onConflict: 'student_id,mentor_id' },
      )
      .select(`
        *,
        student:student_id(id,email,full_name),
        mentor:mentor_id(id,email,full_name)
      `)
      .single()
    if (error) throw error

    res.status(201).json({ mentorship: sanitizeMentorship(data!) })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to send mentorship request' })
  }
})

mentorshipRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.body.status
    if (!['accepted', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Status must be accepted or rejected' })
      return
    }

    const { data: request, error: findError } = await supabaseAdmin
      .from('mentorship_requests')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (findError) throw findError
    if (!request) {
      res.status(404).json({ error: 'Mentorship request not found' })
      return
    }
    if (request.mentor_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the mentor can respond to this request' })
      return
    }
    if (request.status !== 'pending') {
      res.status(409).json({ error: 'This mentorship request has already been reviewed' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('mentorship_requests')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(`
        *,
        student:student_id(id,email,full_name),
        mentor:mentor_id(id,email,full_name)
      `)
      .single()
    if (error) throw error

    res.json({ mentorship: sanitizeMentorship(data!) })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to update mentorship request' })
  }
})
