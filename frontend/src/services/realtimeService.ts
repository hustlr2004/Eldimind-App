import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './apiClient';

let socket: Socket | null = null;

export function getRealtimeSocket(uid: string) {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }

  socket.emit('join-user', { uid });
  return socket;
}
