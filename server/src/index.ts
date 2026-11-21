import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { supabase } from './config/supabase.js'
import { profileRouter } from './routes/profiles.js'
import { mentorshipRouter } from './routes/mentorships.js'
import { sessionRouter } from './routes/sessions.js'
import { registerChatHandler } from './socket/chatHandler.js'

const app = express()
app.use(cors({
  origin(origin, callback) {
    if (
      !origin
      || origin === env.clientUrl
      || origin.endsWith('.app.github.dev')
    ) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed'))
  },
}))
app.use(express.json())

app.get('/', (_req, res) => {
  res.redirect(env.clientUrl)
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'MentorBridge API' })
})

app.use('/api/profiles', profileRouter)
app.use('/api/mentorships', mentorshipRouter)
app.use('/api/sessions', sessionRouter)

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.clientUrl,
    methods: ['GET', 'POST'],
  },
})

io.use(async (socket, next) => {
  const token = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    next(new Error('Unauthorized'))
    return
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    next(new Error('Unauthorized'))
    return
  }

  socket.data.userId = data.user.id
  next()
})

io.on('connection', (socket) => {
  registerChatHandler(io, socket)
})

httpServer.listen(env.port, () => {
  console.log(`MentorBridge server listening on http://localhost:${env.port}`)
})
