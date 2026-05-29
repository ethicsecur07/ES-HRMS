"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSockets = void 0;
const socket_io_1 = require("socket.io");
const logger_js_1 = require("../utils/logger.js");
const jwt_js_1 = require("../utils/jwt.js");
const UserSession_js_1 = require("../models/UserSession.js");
let ioInstance = null;
// Online presence map: userId -> { organizationId, socketIds } (supports multi-tab)
const onlineUsers = new Map();
const getOnlineUserIdsByOrg = (orgId) => {
    const ids = [];
    for (const [userId, data] of onlineUsers.entries()) {
        if (data.organizationId === orgId) {
            ids.push(userId);
        }
    }
    return ids;
};
const initSockets = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    ioInstance = io;
    // Socket Authentication Middleware (Zero-Trust Session Validation)
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token ||
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
                const mockUsers = {
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
                    socket.user = {
                        id: dbUser.id,
                        role: dbUser.role,
                        email: dbUser.email,
                        organizationId: dbUser.organizationId.toString()
                    };
                    return next();
                }
                else {
                    return next(new Error('Demo user not found in database.'));
                }
            }
            const decoded = (0, jwt_js_1.verifyToken)(token);
            if (!decoded || !decoded.id) {
                return next(new Error('Authentication error. Invalid token.'));
            }
            if (decoded.sessionId) {
                const session = await UserSession_js_1.UserSession.findById(decoded.sessionId);
                if (!session || session.isRevoked || session.expiresAt < new Date()) {
                    return next(new Error('Authentication error. Session revoked or expired.'));
                }
            }
            socket.user = decoded;
            next();
        }
        catch (err) {
            logger_js_1.logger.error('Socket authentication failed:', err);
            next(new Error('Authentication error.'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.user;
        logger_js_1.logger.info(`Socket connected: ${socket.id} (User: ${user?.email})`);
        // ── Auto-join standard rooms ──────────────────────────────────────────
        if (user) {
            socket.join(`org_${user.organizationId}`);
            socket.join(`user_${user.id}`);
            socket.join(`role_${user.role}`);
            socket.join(`org_${user.organizationId}_role_${user.role}`);
            logger_js_1.logger.info(`Socket ${socket.id} joined rooms: org_${user.organizationId}, user_${user.id}, role_${user.role}`);
            // ── Online Presence Tracking ─────────────────────────────────────────
            // IMPORTANT: Add user to map FIRST, then emit so the list is complete
            if (!onlineUsers.has(user.id)) {
                onlineUsers.set(user.id, { organizationId: user.organizationId, socketIds: new Set() });
            }
            onlineUsers.get(user.id).socketIds.add(socket.id);
            // Broadcast to ALL org members (including self) that this user is online
            io.to(`org_${user.organizationId}`).emit('user_online', { userId: user.id });
            // Send the FULL current list of online users in this organization to only the newly connected socket
            socket.emit('online_users', getOnlineUserIdsByOrg(user.organizationId));
        }
        // ── Group/Broadcast room join ──────────────────────────────────────────
        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            logger_js_1.logger.info(`Socket ${socket.id} joined room: ${roomId}`);
        });
        socket.on('join_project_board', (projectId) => {
            const room = `project_${projectId}`;
            socket.join(room);
            logger_js_1.logger.info(`Socket ${socket.id} joined project board room: ${room}`);
        });
        // ── Legacy Notification Event ──────────────────────────────────────────
        socket.on('send_notification', (data) => {
            if (user && data.organizationId && user.organizationId !== data.organizationId) {
                logger_js_1.logger.warn(`Cross-tenant notification attempt blocked for user ${user.email}`);
                return;
            }
            io.to(data.targetRole).emit('receive_notification', data);
        });
        // ── Typing Indicators ──────────────────────────────────────────────────
        socket.on('typing_start', ({ receiverId }) => {
            if (!user)
                return;
            if (receiverId.startsWith('group_') || receiverId === 'broadcast') {
                io.to(receiverId).emit('user_typing', { userId: user.id, receiverId });
            }
            else {
                io.to(`user_${receiverId}`).emit('user_typing', { userId: user.id, receiverId });
            }
        });
        socket.on('typing_stop', ({ receiverId }) => {
            if (!user)
                return;
            if (receiverId.startsWith('group_') || receiverId === 'broadcast') {
                io.to(receiverId).emit('user_stop_typing', { userId: user.id, receiverId });
            }
            else {
                io.to(`user_${receiverId}`).emit('user_stop_typing', { userId: user.id, receiverId });
            }
        });
        // ── Disconnect ──────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            logger_js_1.logger.info(`Socket disconnected: ${socket.id}`);
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
exports.initSockets = initSockets;
const getIO = () => {
    if (!ioInstance) {
        logger_js_1.logger.error('Socket.io not initialized!');
        return null;
    }
    return ioInstance;
};
exports.getIO = getIO;
