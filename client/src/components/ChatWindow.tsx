import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { connectSocket, socket } from '../lib/socket'

interface ChatMessage {
  id: string
  mentorship_request_id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
}

interface ChatWindowProps {
  mentorshipId: string
  recipientName: string
}

export function ChatWindow({ mentorshipId, recipientName }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [typing, setTyping] = useState(false)
  const [userId, setUserId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (!data.session) {
        setError('Sign in to use chat')
        return
      }
      setUserId(data.session.user.id)
      connectSocket(data.session.access_token)
    })

    function onMessage(message: ChatMessage) {
      if (message.mentorship_request_id === mentorshipId) {
        setMessages((current) => [...current.filter((item) => item.id !== message.id), message])
      }
    }

    function onTyping(payload: { mentorship_id: string; is_typing: boolean }) {
      if (payload.mentorship_id === mentorshipId) setTyping(payload.is_typing)
    }

    socket.on('chat:message', onMessage)
    socket.on('chat:typing', onTyping)

    function join() {
      socket.emit('chat:join', mentorshipId, (ack: { error?: string; messages?: ChatMessage[] }) => {
        if (ack.error) setError(ack.error)
        else setMessages(ack.messages ?? [])
      })
    }

    socket.on('connect', join)
    if (socket.connected) join()

    return () => {
      active = false
      socket.emit('chat:leave', mentorshipId)
      socket.off('chat:message', onMessage)
      socket.off('chat:typing', onTyping)
      socket.off('connect', join)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
    }
  }, [mentorshipId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function updateDraft(value: string) {
    setDraft(value)
    socket.emit('chat:typing', { mentorship_id: mentorshipId, is_typing: true })
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('chat:typing', { mentorship_id: mentorshipId, is_typing: false })
    }, 1200)
  }

  function send(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    socket.emit('chat:send', { mentorship_id: mentorshipId, content }, (ack: { error?: string }) => {
      if (ack.error) setError(ack.error)
      else setDraft('')
    })
  }

  return (
    <section className="chat-window">
      <div className="chat-header">
        <strong>{recipientName}</strong>
        {typing && <span className="typing-indicator">typing...</span>}
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div
            className={message.sender_id === userId ? 'chat-bubble sent' : 'chat-bubble received'}
            key={message.id}
          >
            <span>{message.content}</span>
            <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
        {!messages.length && <p className="muted">Start the conversation.</p>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          placeholder="Write a message..."
          aria-label="Message"
        />
        <button className="primary-button" type="submit">Send</button>
      </form>
    </section>
  )
}
