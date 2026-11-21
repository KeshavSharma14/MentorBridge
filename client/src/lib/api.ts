import { supabase } from './supabase'

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed')
  }
  return payload as T
}

export interface Profile {
  user_id: string
  role: 'student' | 'mentor'
  headline?: string
  bio?: string
  skills: string[]
  interests: string[]
  goals: string[]
  availability: Record<string, string[]>
  contact_info: Record<string, unknown>
  share_contact: boolean
  users?: { full_name?: string; email?: string }
}

export interface Mentorship {
  id: string
  student_id: string
  mentor_id: string
  status: 'pending' | 'accepted' | 'rejected'
  message?: string
  created_at: string
  responded_at?: string
  student?: { id: string; full_name?: string; email?: string }
  mentor?: { id: string; full_name?: string; email?: string }
}

export interface Recommendation {
  profile: Profile
  score: number
  sharedSkills: string[]
  sharedInterests: string[]
  sharedGoals: string[]
  breakdown: {
    skills: number
    interests: number
    goals: number
    availability: number
  }
}

export interface MentorshipSession {
  id: string
  mentorship_request_id: string
  mentor_id: string
  student_id: string
  proposed_by: string
  title: string
  starts_at: string
  ends_at: string
  meeting_link?: string
  notes?: string
  status: 'proposed' | 'confirmed' | 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export const profilesApi = {
  getAll: (role?: 'student' | 'mentor') =>
    request<{ profiles: Profile[] }>(`/api/profiles${role ? `?role=${role}` : ''}`),
  getRecommendations: () =>
    request<{ recommendations: Recommendation[] }>('/api/profiles/recommendations'),
  getMe: () => request<{ profile: Profile }>('/api/profiles/me'),
  get: (id: string) => request<{ profile: Profile }>(`/api/profiles/${id}`),
  save: (profile: Partial<Profile>) =>
    request<{ profile: Profile }>('/api/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
  setPrivacy: (share_contact: boolean) =>
    request<{ profile: { share_contact: boolean } }>('/api/profiles/me/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ share_contact }),
    }),
}

export const mentorshipsApi = {
  getAll: () => request<{ mentorships: Mentorship[] }>('/api/mentorships'),
  send: (mentor_id: string, message?: string) =>
    request<{ mentorship: Mentorship }>('/api/mentorships', {
      method: 'POST',
      body: JSON.stringify({ mentor_id, message }),
    }),
  respond: (id: string, status: 'accepted' | 'rejected') =>
    request<{ mentorship: Mentorship }>(`/api/mentorships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

export const sessionsApi = {
  list: (mentorshipId?: string) =>
    request<{ sessions: MentorshipSession[]; mutual_availability: Record<string, string[]> }>(
      `/api/sessions${mentorshipId ? `?mentorship_id=${encodeURIComponent(mentorshipId)}` : ''}`,
    ),
  propose: (payload: {
    mentorship_id: string
    starts_at: string
    ends_at: string
    title?: string
    meeting_link?: string
    notes?: string
  }) =>
    request<{ session: MentorshipSession }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirm: (id: string) =>
    request<{ session: MentorshipSession }>(`/api/sessions/${id}/confirm`, {
      method: 'PATCH',
    }),
}
