import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey)

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export function createUserClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
