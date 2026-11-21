import { Router, type Request, type Response } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { rankRecommendations } from '../services/recommendationService.js'

export const profileRouter = Router()

type ProfileRole = 'student' | 'mentor'

interface ProfileInput {
  role: ProfileRole
  headline?: string
  bio?: string
  skills?: string[]
  interests?: string[]
  goals?: string[]
  availability?: Record<string, unknown>
  contact_info?: Record<string, unknown>
  share_contact?: boolean
}

function cleanContactInfo(profile: Record<string, any>, requesterId: string, accepted: boolean) {
  const visible = profile.user_id === requesterId || (accepted && profile.share_contact === true)
  if (visible) {
    if (profile.users) {
      return { ...profile, users: { ...profile.users } }
    }
    return profile
  }

  const contactInfo = profile.contact_info && typeof profile.contact_info === 'object'
    ? { ...profile.contact_info }
    : {}

  delete contactInfo.email
  delete contactInfo.phone
  delete contactInfo.linkedin

  const sanitized: Record<string, any> = {
    ...profile,
    email: undefined,
    contact_info: contactInfo,
  }
  if (sanitized.users) {
    sanitized.users = { ...sanitized.users }
    delete sanitized.users.email
  }
  return sanitized
}

async function hasAcceptedMentorship(requesterId: string, profileUserId: string) {
  if (requesterId === profileUserId) return true

  const { data, error } = await supabaseAdmin
    .from('mentorship_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(student_id.eq.${requesterId},mentor_id.eq.${profileUserId}),and(student_id.eq.${profileUserId},mentor_id.eq.${requesterId})`)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

profileRouter.use(requireAuth)

profileRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.query.role
    let query = supabaseAdmin
      .from('profiles')
      .select('*, users:users(full_name,email)')

    if (role === 'student' || role === 'mentor') {
      query = query.eq('role', role)
    }

    const { data, error } = await query
    if (error) throw error

    const profiles = await Promise.all((data ?? []).map(async (profile: any) => {
      const accepted = await hasAcceptedMentorship(req.user!.id, profile.user_id)
      const sanitized = cleanContactInfo(profile, req.user!.id, accepted)
      if (!sanitized.email) delete sanitized.email
      return sanitized
    }))

    res.json({ profiles })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to load profiles' })
  }
})

profileRouter.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, users:users(full_name,email)')
      .eq('user_id', req.user!.id)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json({ profile: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to load profile' })
  }
})

profileRouter.put('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as ProfileInput
    if (!body.role || !['student', 'mentor'].includes(body.role)) {
      res.status(400).json({ error: 'A valid role is required' })
      return
    }

    const userPayload = {
      id: req.user!.id,
      email: req.user!.email ?? '',
    }
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert(userPayload, { onConflict: 'id' })
    if (userError) throw userError

    const profilePayload = {
      user_id: req.user!.id,
      role: body.role,
      headline: body.headline?.trim() || null,
      bio: body.bio?.trim() || null,
      skills: Array.isArray(body.skills) ? body.skills.filter(Boolean).slice(0, 50) : [],
      interests: Array.isArray(body.interests) ? body.interests.filter(Boolean).slice(0, 50) : [],
      goals: Array.isArray(body.goals) ? body.goals.filter(Boolean).slice(0, 50) : [],
      availability: body.availability && typeof body.availability === 'object' ? body.availability : {},
      contact_info: body.contact_info && typeof body.contact_info === 'object' ? body.contact_info : {},
      share_contact: body.share_contact === true,
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })
      .select('*, users:users(full_name,email)')
      .single()
    if (error) throw error

    res.json({ profile: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to save profile' })
  }
})

profileRouter.patch('/me/privacy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (typeof req.body.share_contact !== 'boolean') {
      res.status(400).json({ error: 'share_contact must be a boolean' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ share_contact: req.body.share_contact })
      .eq('user_id', req.user!.id)
      .select('share_contact')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json({ profile: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to update privacy setting' })
  }
})

profileRouter.get('/recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedLimit = Number.parseInt(
      typeof req.query.limit === 'string' ? req.query.limit : '20',
      10,
    )
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20

    const { data: ownProfile, error: ownError } = await supabaseAdmin
      .from('profiles')
      .select('*, users:users(full_name,email)')
      .eq('user_id', req.user!.id)
      .maybeSingle()
    if (ownError) throw ownError
    if (!ownProfile) {
      res.status(404).json({ error: 'Create a profile before viewing recommendations' })
      return
    }

    const oppositeRole = ownProfile.role === 'student' ? 'mentor' : 'student'
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('profiles')
      .select('*, users:users(full_name,email)')
      .eq('role', oppositeRole)
      .neq('user_id', req.user!.id)
      .limit(100)
    if (candidatesError) throw candidatesError

    const ranked = rankRecommendations(ownProfile, candidates ?? []).slice(0, limit)
    const recommendations = await Promise.all(ranked.map(async (match) => {
      const accepted = await hasAcceptedMentorship(req.user!.id, match.profile.user_id)
      return {
        ...match,
        profile: cleanContactInfo(match.profile, req.user!.id, accepted),
      }
    }))

    res.json({ recommendations })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to load recommendations' })
  }
})

profileRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, users:users(full_name,email)')
      .eq('user_id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const accepted = await hasAcceptedMentorship(req.user!.id, profileId)
    const sanitized = cleanContactInfo(data, req.user!.id, accepted)
    if (profileId !== req.user!.id) {
      delete sanitized.email
    }

    res.json({ profile: sanitized })
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Unable to load profile' })
  }
})
