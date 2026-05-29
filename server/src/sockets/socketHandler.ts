import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../utils/jwt.js';
import { UserSession } from '../models/UserSession.js';

let ioInstance: SocketIOServer | null = null;

// Online presence map: userId -> { organizationId, socketIds } (supports multi-tab)
const onlineUsers = new Map<string, { organizationId: string; socketIds: Set<string> }>();

const getOnlineUserIdsByOrg = (orgId: string): string[] => {
  const ids: string[] = [];
  for (const [userId, data] of onlineUsers.entries()) {
    if (data.organizationId === orgId) {
      ids.push(userId);
    }
  }
  return ids;
};

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

    // ── Auto-join standard rooms ──────────────────────────────────────────
    if (user) {
      socket.join(`org_${user.organizationId}`);
      socket.join(`user_${user.id}`);
      socket.join(`role_${user.role}`);
      socket.join(`org_${user.organizationId}_role_${user.role}`);
      logger.info(`Socket ${socket.id} joined rooms: org_${user.organizationId}, user_${user.id}, role_${user.role}`);

      // ── Online Presence Tracking ─────────────────────────────────────────
      // IMPORTANT: Add user to map FIRST, then emit so the list is complete
      if (!onlineUsers.has(user.id)) {
        onlineUsers.set(user.id, { organizationId: user.organizationId, socketIds: new Set() });
      }
      onlineUsers.get(user.id)!.socketIds.add(socket.id);

      // Broadcast to ALL org members (including self) that this user is online
      io.to(`org_${user.organizationId}`).emit('user_online', { userId: user.id });

      // Send the FULL current list of online users in this organization to only the newly connected socket
      socket.emit('online_users', getOnlineUserIdsByOrg(user.organizationId));
    }

    // ── Group/Broadcast room join ──────────────────────────────────────────
    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      logger.info(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('join_project_board', (projectId: string) => {
      const room = `project_${projectId}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} joined project board room: ${room}`);
    });

    // ── Legacy Notification Event ──────────────────────────────────────────
    socket.on('send_notification', (data) => {
      if (user && data.organizationId && user.organizationId !== data.organizationId) {
        logger.warn(`Cross-tenant notification attempt blocked for user ${user.email}`);
        return;
      }
      io.to(data.targetRole).emit('receive_notification', data);
    });

    // ── Typing Indicators ──────────────────────────────────────────────────
    socket.on('typing_start', ({ receiverId }: { receiverId: string }) => {
      if (!user) return;
      if (receiverId.startsWith('group_') || receiverId === 'broadcast') {
        io.to(receiverId).emit('user_typing', { userId: user.id, receiverId });
      } else {
        io.to(`user_${receiverId}`).emit('user_typing', { userId: user.id, receiverId });
      }
    });

    socket.on('typing_stop', ({ receiverId }: { receiverId: string }) => {
      if (!user) return;
      if (receiverId.startsWith('group_') || receiverId === 'broadcast') {
        io.to(receiverId).emit('user_stop_typing', { userId: user.id, receiverId });
      } else {
        io.to(`user_${receiverId}`).emit('user_stop_typing', { userId: user.id, receiverId });
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      if (user) {
        const userData = onlineUsers.get(user.id);
        if (userData) {
          userData.socketIds.delete(socket.id);
          // Only mark user as offline when ALL their sockets disconnect (multi-tab support)
          if (userData.socketIds.size === 0) {
            onlineUsers.delete(user.id);
            io.to(`org_${user.organizationId}`).emit('user_offline', { userId: user.id });
          }
        }
      }
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
