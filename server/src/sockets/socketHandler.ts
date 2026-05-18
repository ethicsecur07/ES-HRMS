import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { logger } from '../utils/logger.js';

let ioInstance: SocketIOServer | null = null;

export const initSockets = (httpServer: Server) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join_room', (role: string) => {
      socket.join(role);
      logger.info(`Socket ${socket.id} joined room: ${role}`);
    });

    socket.on('send_notification', (data) => {
      io.to(data.targetRole).emit('receive_notification', data);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!ioInstance) {
    logger.error('Socket.io not initialized!');
    return null;
  }
  return ioInstance;
};
