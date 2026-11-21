import { io, type Socket } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export const socket: Socket = io(socketUrl, {
  autoConnect: false,
})

export function connectSocket(accessToken: string) {
  socket.auth = { token: accessToken }
  if (!socket.connected) socket.connect()
}
