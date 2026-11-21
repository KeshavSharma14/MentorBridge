export interface RecommendationProfile {
  user_id: string
  role: 'student' | 'mentor'
  skills: string[]
  interests: string[]
  goals: string[]
  availability: Record<string, string[]>
}

export interface CompatibilityBreakdown {
  skills: number
  interests: number
  goals: number
  availability: number
}

export interface Recommendation<T extends RecommendationProfile = RecommendationProfile> {
  profile: T
  score: number
  sharedSkills: string[]
  sharedInterests: string[]
  sharedGoals: string[]
  breakdown: CompatibilityBreakdown
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)))
}

export function normalizedAvailability(availability: unknown): Set<string> {
  const slots = new Set<string>()
  if (!availability || typeof availability !== 'object' || Array.isArray(availability)) {
    return slots
  }

  for (const [day, values] of Object.entries(availability as Record<string, unknown>)) {
    if (!Array.isArray(values)) continue
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        slots.add(`${day.trim().toLowerCase()}|${value.trim().toLowerCase()}`)
      }
    }
  }
  return slots
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }
  const union = left.size + right.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function calculateCompatibility(
  student: RecommendationProfile,
  mentor: RecommendationProfile,
) {
  const studentSkills = new Set(normalizeList(student.skills))
  const mentorSkills = new Set(normalizeList(mentor.skills))
  const studentInterests = new Set(normalizeList(student.interests))
  const mentorInterests = new Set(normalizeList(mentor.interests))
  const studentGoals = new Set(normalizeList(student.goals))
  const mentorGoals = new Set(normalizeList(mentor.goals))

  const breakdown: CompatibilityBreakdown = {
    skills: jaccardSimilarity(studentSkills, mentorSkills),
    interests: jaccardSimilarity(studentInterests, mentorInterests),
    goals: jaccardSimilarity(studentGoals, mentorGoals),
    availability: jaccardSimilarity(
      normalizedAvailability(student.availability),
      normalizedAvailability(mentor.availability),
    ),
  }

  const score = Math.round(
    (breakdown.skills * 40)
      + (breakdown.interests * 25)
      + (breakdown.goals * 20)
      + (breakdown.availability * 15),
  )

  return {
    score,
    sharedSkills: [...studentSkills].filter((skill) => mentorSkills.has(skill)),
    sharedInterests: [...studentInterests].filter((interest) => mentorInterests.has(interest)),
    sharedGoals: [...studentGoals].filter((goal) => mentorGoals.has(goal)),
    breakdown,
  }
}

export function rankRecommendations<T extends RecommendationProfile>(
  source: RecommendationProfile,
  candidates: T[],
): Recommendation<T>[] {
  return candidates
    .filter((candidate) => candidate.user_id !== source.user_id)
    .map((candidate) => {
      const student = source.role === 'student' ? source : candidate
      const mentor = source.role === 'mentor' ? source : candidate
      const match = calculateCompatibility(student, mentor)
      return { profile: candidate, ...match }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.profile.user_id.localeCompare(right.profile.user_id)
    })
}
