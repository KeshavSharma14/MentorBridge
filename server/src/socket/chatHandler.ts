import type { Server, Socket } from 'socket.io'
import { supabaseAdmin } from '../config/supabase.js'

interface ChatAck {
  error?: string
  message?: Record<string, unknown>
  messages?: Record<string, unknown>[]
}

export function registerChatHandler(io: Server, socket: Socket) {
  const userId = socket.data.userId as string

  async function getAcceptedPair(mentorshipId: string) {
    const { data, error } = await supabaseAdmin
      .from('mentorship_requests')
      .select('student_id,mentor_id,status')
      .eq('id', mentorshipId)
      .eq('status', 'accepted')
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    if (data.student_id !== userId && data.mentor_id !== userId) return null
    return {
      senderId: userId,
      recipientId: data.student_id === userId ? data.mentor_id : data.student_id,
    }
  }

  socket.on('chat:join', async (mentorshipId: string, ack?: (value: ChatAck) => void) => {
    try {
      if (typeof mentorshipId !== 'string' || !mentorshipId) {
        ack?.({ error: 'mentorship_id is required' })
        return
      }
      const pair = await getAcceptedPair(mentorshipId)
      if (!pair) {
        ack?.({ error: 'You are not an accepted participant in this mentorship' })
        return
      }

      await socket.join(`mentorship:${mentorshipId}`)
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('mentorship_request_id', mentorshipId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      ack?.({ messages: data ?? [] })
    } catch (error: any) {
      ack?.({ error: error.message ?? 'Unable to join chat' })
    }
  })

  socket.on('chat:leave', async (mentorshipId: string) => {
    if (typeof mentorshipId === 'string') {
      await socket.leave(`mentorship:${mentorshipId}`)
      socket.to(`mentorship:${mentorshipId}`).emit('chat:typing', {
        mentorship_id: mentorshipId,
        user_id: userId,
        is_typing: false,
      })
    }
  })

  socket.on('chat:send', async (
    payload: { mentorship_id?: unknown; content?: unknown },
    ack?: (value: ChatAck) => void,
  ) => {
    try {
      const mentorshipId = typeof payload?.mentorship_id === 'string' ? payload.mentorship_id : ''
      const content = typeof payload?.content === 'string' ? payload.content.trim() : ''
      if (!mentorshipId || !content) {
        ack?.({ error: 'mentorship_id and message content are required' })
        return
      }
      if (content.length > 5000) {
        ack?.({ error: 'Messages cannot exceed 5000 characters' })
        return
      }

      const pair = await getAcceptedPair(mentorshipId)
      if (!pair) {
        ack?.({ error: 'You are not an accepted participant in this mentorship' })
        return
      }

      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          mentorship_request_id: mentorshipId,
          sender_id: pair.senderId,
          recipient_id: pair.recipientId,
          content,
        })
        .select('*')
        .single()
      if (error) throw error

      io.to(`mentorship:${mentorshipId}`).emit('chat:message', data)
      ack?.({ message: data })
    } catch (error: any) {
      ack?.({ error: error.message ?? 'Unable to send message' })
    }
  })

  socket.on('chat:typing', (
    payload: { mentorship_id?: unknown; is_typing?: unknown },
  ) => {
    if (
      typeof payload?.mentorship_id !== 'string'
      || typeof payload.is_typing !== 'boolean'
    ) return

    void getAcceptedPair(payload.mentorship_id).then((pair) => {
      if (!pair) return
      socket.to(`mentorship:${payload.mentorship_id}`).emit('chat:typing', {
        mentorship_id: payload.mentorship_id,
        user_id: userId,
        is_typing: payload.is_typing,
      })
    })
  })
}
