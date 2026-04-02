import { Server as SocketIOServer } from 'socket.io';
import { CallLog } from '../models/CallLog';

type SocketData = {
  uid?: string;
};

const connectedUsers = new Map<string, Set<string>>();

function addSocket(uid: string, socketId: string) {
  const existing = connectedUsers.get(uid) || new Set<string>();
  existing.add(socketId);
  connectedUsers.set(uid, existing);
}

function removeSocket(uid: string, socketId: string) {
  const existing = connectedUsers.get(uid);
  if (!existing) return;
  existing.delete(socketId);
  if (existing.size === 0) {
    connectedUsers.delete(uid);
  }
}

function emitToUser(io: SocketIOServer, uid: string, event: string, payload: any) {
  const socketIds = connectedUsers.get(uid) || new Set<string>();
  for (const socketId of socketIds) {
    io.to(socketId).emit(event, payload);
  }
}

export function registerSignaling(io: SocketIOServer) {
  io.on('connection', (socket) => {
    const socketData = socket.data as SocketData;

    socket.on('join-user', (payload: { uid: string }) => {
      socketData.uid = payload.uid;
      addSocket(payload.uid, socket.id);
    });

    socket.on('call:offer', (payload: any) => {
      emitToUser(io, payload.to, 'call:offer', payload);
    });

    socket.on('call:answer', (payload: any) => {
      emitToUser(io, payload.to, 'call:answer', payload);
    });

    socket.on('call:ice-candidate', (payload: any) => {
      emitToUser(io, payload.to, 'call:ice-candidate', payload);
    });

    socket.on('call:end', (payload: any) => {
      emitToUser(io, payload.to, 'call:end', payload);
    });

    socket.on('call:missed', async (payload: any) => {
      emitToUser(io, payload.to, 'call:missed', payload);
      await CallLog.create({
        elderUid: payload.elderUid,
        caretakerUid: payload.caretakerUid,
        type: payload.type || 'video',
        status: 'missed',
        startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
        endedAt: payload.endedAt ? new Date(payload.endedAt) : undefined,
      });
    });

    socket.on('disconnect', () => {
      if (socketData.uid) {
        removeSocket(socketData.uid, socket.id);
      }
    });
  });
}
