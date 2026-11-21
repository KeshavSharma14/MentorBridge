import type { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  accessToken?: string
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization bearer token required' })
    return
  }

  const accessToken = authorization.slice('Bearer '.length)
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }

  req.accessToken = accessToken
  req.user = {
    id: data.user.id,
    email: data.user.email,
  }
  next()
}
