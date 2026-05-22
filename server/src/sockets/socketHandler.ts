import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { logger } from '../utils/logger.js';

import { verifyToken } from '../utils/jwt.js';
import { UserSession } from '../models/UserSession.js';

let ioInstance: SocketIOServer | null = null;

export const initSockets = (httpServer: Server) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  // Socket Authentication Middleware (Zero-Trust Session Validation)
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : socket.handshake.headers.authorization);

      if (!token) {
        return next(new Error('Authentication error. Token missing.'));
      }

      // Developer Sandbox Bypass
      if (token.startsWith('demo-jwt-token-')) {
        if (process.env.NODE_ENV === 'production') {
          return next(new Error('Demo tokens disabled in production.'));
        }
        
        const demoRole = token.replace('demo-jwt-token-', '').toUpperCase();
        const mockUsers: Record<string, any> = {
          ADMIN: { role: 'ADMIN', email: 'Official@ethicsecur.co.in' },
          MANAGER: { role: 'MANAGER', email: 'siddharth@ethicsecur.com' },
          HR: { role: 'HR', email: 'oviya@ethicsecur.com' },
          TEAM_LEAD: { role: 'TEAM_LEAD', email: 'karthik@ethicsecur.com' },
          EMPLOYEE: { role: 'EMPLOYEE', email: 'logapriyan@ethicsec.com' },
        };
        
        const targetUser = mockUsers[demoRole] || mockUsers.EMPLOYEE;
        
        // In sockets, we can't easily use await without importing User model, but we can do it if needed.
        // Actually, we can just import User at the top and await it.
        const { User } = await import('../models/User.js');
        const dbUser = await User.findOne({ email: new RegExp('^' + targetUser.email + '$', 'i') });

        if (dbUser) {
          (socket as any).user = {
            id: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
            organizationId: dbUser.organizationId.toString()
          };
          return next();
        } else {
          return next(new Error('Demo user not found in database.'));
        }
      }

      const decoded = verifyToken(token) as any;
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error. Invalid token.'));
      }

      if (decoded.sessionId) {
        const session = await UserSession.findById(decoded.sessionId);
        if (!session || session.isRevoked || session.expiresAt < new Date()) {
          return next(new Error('Authentication error. Session revoked or expired.'));
        }
      }

      (socket as any).user = decoded;
      next();
    } catch (err) {
      logger.error('Socket authentication failed:', err);
      next(new Error('Authentication error.'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} (User: ${user?.email})`);

    // Auto-join standard rooms
    if (user) {
      socket.join(`org_${user.organizationId}`);
      socket.join(`user_${user.id}`);
      socket.join(`role_${user.role}`);
      logger.info(`Socket ${socket.id} joined rooms: org_${user.organizationId}, user_${user.id}, role_${user.role}`);
    }

    socket.on('join_room', (role: string) => {
      socket.join(role);
      logger.info(`Socket ${socket.id} joined room: ${role}`);
    });

    socket.on('join_project_board', (projectId: string) => {
      const room = `project_${projectId}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} joined project board room: ${room}`);
    });

    socket.on('send_notification', (data) => {
      // Validate sender context matches room organization to prevent cross-tenant message injection
      if (user && data.organizationId && user.organizationId !== data.organizationId) {
        logger.warn(`Cross-tenant notification attempt blocked for user ${user.email}`);
        return;
      }
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
