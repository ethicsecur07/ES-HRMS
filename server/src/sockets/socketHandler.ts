import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../utils/jwt.js';
import { UserSession } from '../models/UserSession.js';

let ioInstance: SocketIOServer | null = null;

/**
 * Online Presence – simplified model:
 *  - A user is ONLINE  ↔ they have ≥ 1 connected socket.
 *  - A user is OFFLINE ↔ ALL their sockets have disconnected AND the 8-second
 *    reconnect grace period has elapsed.
 *
 * We intentionally do NOT use "active/inactive" signals for the online dot.
 * That would cause false-offline events every time someone alt-tabs or opens
 * DevTools.  The `user_active` / `user_inactive` socket events are kept only
 * as no-ops so existing clients don't break, but they no longer affect the
 * online indicator.
 */

// userId → { organizationId, sockets: Set<socketId> }
const userPresence = new Map<string, {
  organizationId: string;
  sockets: Set<string>;
}>();

// userId → reconnect grace-period timer
const disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/** Return all userIds in an org that currently have ≥ 1 socket connected */
const getOnlineUserIdsByOrg = (orgId: string): string[] => {
  const ids: string[] = [];
  for (const [userId, presence] of userPresence.entries()) {
    if (presence.organizationId === orgId && presence.sockets.size > 0) {
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
    // Keep-alive tuning: ping every 10 s, timeout after 20 s
    pingInterval: 10000,
    pingTimeout: 20000,
  });

  ioInstance = io;

  // ── Authentication Middleware (Zero-Trust Session Validation) ──────────────
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
          ADMIN:     { role: 'ADMIN',     email: 'Official@ethicsecur.co.in' },
          MANAGER:   { role: 'MANAGER',   email: 'siddharth@ethicsecur.com' },
          HR:        { role: 'HR',        email: 'oviya@ethicsecur.com' },
          TEAM_LEAD: { role: 'TEAM_LEAD', email: 'karthik@ethicsecur.com' },
          EMPLOYEE:  { role: 'EMPLOYEE',  email: 'logapriyan@ethicsec.com' },
        };

        const targetUser = mockUsers[demoRole] || mockUsers.EMPLOYEE;
        const { User } = await import('../models/User.js');
        const dbUser = await User.findOne({
          email: new RegExp('^' + targetUser.email + '$', 'i'),
        });

        if (dbUser) {
          (socket as any).user = {
            id: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
            organizationId: dbUser.organizationId.toString(),
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

    // ── Auto-join standard rooms ─────────────────────────────────────────────
    if (user) {
      socket.join(`org_${user.organizationId}`);
      socket.join(`user_${user.id}`);
      socket.join(`role_${user.role}`);
      socket.join(`org_${user.organizationId}_role_${user.role}`);
      logger.info(
        `Socket ${socket.id} joined rooms: org_${user.organizationId}, user_${user.id}, role_${user.role}`
      );

      // ── Presence: register this socket ──────────────────────────────────
      // If there's a pending offline timer for this user, cancel it.
      // This handles the page-refresh race condition gracefully.
      if (disconnectTimeouts.has(user.id)) {
        clearTimeout(disconnectTimeouts.get(user.id)!);
        disconnectTimeouts.delete(user.id);
        logger.info(`Reconnect within grace period for user ${user.email} — offline cancelled.`);
      }

      if (!userPresence.has(user.id)) {
        userPresence.set(user.id, {
          organizationId: user.organizationId,
          sockets: new Set(),
        });
      }

      const presence = userPresence.get(user.id)!;
      const wasOffline = presence.sockets.size === 0;
      presence.sockets.add(socket.id);

      if (wasOffline) {
        // Broadcast to ALL org members that this user is now online
        io.to(`org_${user.organizationId}`).emit('user_online', { userId: user.id });
        logger.info(`User ${user.email} is now ONLINE (socket: ${socket.id}).`);
      }

      // Send the full current online list to ONLY the newly connected socket
      socket.emit('online_users', getOnlineUserIdsByOrg(user.organizationId));
    }

    // ── Group/Broadcast room join ────────────────────────────────────────────
    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      logger.info(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('join_project_board', (projectId: string) => {
      const room = `project_${projectId}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} joined project board room: ${room}`);
    });

    // ── Legacy Notification Event ────────────────────────────────────────────
    // Fix: targetRole must use the `role_${role}` room format used when joining
    socket.on('send_notification', (data) => {
      if (user && data.organizationId && user.organizationId !== data.organizationId) {
        logger.warn(`Cross-tenant notification attempt blocked for user ${user.email}`);
        return;
      }
      // data.targetRole should be a raw role like "ADMIN" — emit to the joined room
      const targetRoom = data.targetRole?.startsWith('role_')
        ? data.targetRole
        : `role_${data.targetRole}`;
      io.to(targetRoom).emit('receive_notification', data);
    });

    // ── Typing Indicators ────────────────────────────────────────────────────
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

    // ── Active/Inactive Presence (no-op for online dot, kept for API compat) ─
    // These events are intentionally ignored for the online indicator.
    // Online = connected socket. Inactive just means the tab is backgrounded.
    socket.on('user_active', () => {
      // No-op: online status is derived from socket connectivity only
    });

    socket.on('user_inactive', () => {
      // No-op: online status is derived from socket connectivity only
    });

    // ── Hard offline signal (fired on beforeunload / tab close) ─────────────
    // Bypasses the 8-second grace period so other users see the offline dot
    // immediately when someone actually closes their browser tab.
    socket.on('user_offline_hard', () => {
      if (!user) return;

      const presence = userPresence.get(user.id);
      if (!presence) return;

      presence.sockets.delete(socket.id);

      // Cancel any existing grace-period timer
      if (disconnectTimeouts.has(user.id)) {
        clearTimeout(disconnectTimeouts.get(user.id)!);
        disconnectTimeouts.delete(user.id);
      }

      if (presence.sockets.size === 0) {
        userPresence.delete(user.id);
        io.to(`org_${user.organizationId}`).emit('user_offline', { userId: user.id });
        logger.info(`User ${user.email} forced OFFLINE via hard-close signal.`);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);

      if (!user) return;

      const presence = userPresence.get(user.id);
      if (!presence) return;

      presence.sockets.delete(socket.id);

      if (presence.sockets.size === 0) {
        // All sockets gone — start the grace period before broadcasting offline.
        // 8 seconds gives the browser enough time to reconnect on page refresh.
        // If a new socket connects within this window, the timeout is cancelled above.
        const timeout = setTimeout(() => {
          const currentPresence = userPresence.get(user.id);
          if (currentPresence && currentPresence.sockets.size === 0) {
            // Clean up presence entry
            userPresence.delete(user.id);
            // Broadcast offline to the whole org
            io.to(`org_${user.organizationId}`).emit('user_offline', { userId: user.id });
            logger.info(`User ${user.email} is now OFFLINE (grace period elapsed).`);
          }
          disconnectTimeouts.delete(user.id);
        }, 8000); // 8-second grace period

        disconnectTimeouts.set(user.id, timeout);
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

export const forceUserOffline = (userId: string) => {
  const presence = userPresence.get(userId);
  if (!presence) return;

  // Cancel any existing grace-period timer
  if (disconnectTimeouts.has(userId)) {
    clearTimeout(disconnectTimeouts.get(userId)!);
    disconnectTimeouts.delete(userId);
  }

  // Clean up user presence
  userPresence.delete(userId);

  // Broadcast to organization
  if (ioInstance) {
    ioInstance.to(`org_${presence.organizationId}`).emit('user_offline', { userId });
  }
  logger.info(`User ${userId} forced OFFLINE via forceUserOffline API.`);
};