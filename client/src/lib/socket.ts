import { io, type Socket } from 'socket.io-client'

const forwardedSocketUrl = typeof window !== 'undefined'
  && window.location.hostname.endsWith('.app.github.dev')
  ? window.location.origin.replace(/-5173\.app\.github\.dev$/, '-4000.app.github.dev')
  : 'http://localhost:4000'
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL
const socketUrl = typeof window !== 'undefined'
  && window.location.hostname.endsWith('.app.github.dev')
  ? forwardedSocketUrl
  : (configuredSocketUrl || forwardedSocketUrl)

export const socket: Socket = io(socketUrl, {
  autoConnect: false,
})

export function connectSocket(accessToken: string) {
  socket.auth = { token: accessToken }
  if (!socket.connected) socket.connect()
}
