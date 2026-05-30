import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../utils/jwt.js';
import { UserSession } from '../models/UserSession.js';

let ioInstance: SocketIOServer | null = null;

// User presence status: userId -> { organizationId, allSockets: Set, activeSockets: Set }
const userPresence = new Map<string, {
  organizationId: string;
  allSockets: Set<string>;
  activeSockets: Set<string>;
}>();
const disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const getOnlineUserIdsByOrg = (orgId: string): string[] => {
  const ids: string[] = [];
  for (const [userId, presence] of userPresence.entries()) {
    if (presence.organizationId === orgId && presence.activeSockets.size > 0) {
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
    pingInterval: 10000,
    pingTimeout: 5000,
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
      // Clear any pending offline grace-period timeout if they reconnect
      if (disconnectTimeouts.has(user.id)) {
        clearTimeout(disconnectTimeouts.get(user.id)!);
        disconnectTimeouts.delete(user.id);
      }

      if (!userPresence.has(user.id)) {
        userPresence.set(user.id, {
          organizationId: user.organizationId,
          allSockets: new Set(),
          activeSockets: new Set()
        });
      }
      
      const presence = userPresence.get(user.id)!;
      presence.allSockets.add(socket.id);
      
      // Default to active on connection
      const wasOffline = presence.activeSockets.size === 0;
      presence.activeSockets.add(socket.id);

      if (wasOffline) {
        // Broadcast to ALL org members (including self) that this user is online
        io.to(`org_${user.organizationId}`).emit('user_online', { userId: user.id });
      }

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

    // ── Active Presence events ──────────────────────────────────────────────
    socket.on('user_active', () => {
      if (!user) return;

      if (disconnectTimeouts.has(user.id)) {
        clearTimeout(disconnectTimeouts.get(user.id)!);
        disconnectTimeouts.delete(user.id);
      }

      if (!userPresence.has(user.id)) {
        userPresence.set(user.id, {
          organizationId: user.organizationId,
          allSockets: new Set([socket.id]),
          activeSockets: new Set()
        });
      }

      const presence = userPresence.get(user.id)!;
      const wasOffline = presence.activeSockets.size === 0;
      presence.activeSockets.add(socket.id);

      if (wasOffline) {
        io.to(`org_${user.organizationId}`).emit('user_online', { userId: user.id });
        logger.info(`User ${user.email} went online (active).`);
      }
    });

    socket.on('user_inactive', () => {
      if (!user) return;

      const presence = userPresence.get(user.id);
      if (presence) {
        presence.activeSockets.delete(socket.id);

        if (presence.activeSockets.size === 0) {
          io.to(`org_${user.organizationId}`).emit('user_offline', { userId: user.id });
          logger.info(`User ${user.email} went offline (inactive).`);
        }
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      if (user) {
        const presence = userPresence.get(user.id);
        if (presence) {
          presence.allSockets.delete(socket.id);
          const wasActive = presence.activeSockets.has(socket.id);
          presence.activeSockets.delete(socket.id);

          // Only mark user as offline when ALL their active sockets disconnect
          if (presence.activeSockets.size === 0 && wasActive) {
            const timeout = setTimeout(() => {
              const currentPresence = userPresence.get(user.id);
              if (currentPresence && currentPresence.activeSockets.size === 0) {
                if (currentPresence.allSockets.size === 0) {
                  userPresence.delete(user.id);
                }
                io.to(`org_${user.organizationId}`).emit('user_offline', { userId: user.id });
                logger.info(`User ${user.email} marked offline after disconnect grace period.`);
              }
              disconnectTimeouts.delete(user.id);
            }, 3000);

            disconnectTimeouts.set(user.id, timeout);
          } else if (presence.allSockets.size === 0) {
            // Clean up entry completely if no socket sessions remain at all
            userPresence.delete(user.id);
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
