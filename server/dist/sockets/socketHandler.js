"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSockets = void 0;
const socket_io_1 = require("socket.io");
const logger_js_1 = require("../utils/logger.js");
const jwt_js_1 = require("../utils/jwt.js");
const UserSession_js_1 = require("../models/UserSession.js");
let ioInstance = null;
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
        // Auto-join standard rooms
        if (user) {
            socket.join(`org_${user.organizationId}`);
            socket.join(`user_${user.id}`);
            socket.join(`role_${user.role}`);
            logger_js_1.logger.info(`Socket ${socket.id} joined rooms: org_${user.organizationId}, user_${user.id}, role_${user.role}`);
        }
        socket.on('join_room', (role) => {
            socket.join(role);
            logger_js_1.logger.info(`Socket ${socket.id} joined room: ${role}`);
        });
        socket.on('join_project_board', (projectId) => {
            const room = `project_${projectId}`;
            socket.join(room);
            logger_js_1.logger.info(`Socket ${socket.id} joined project board room: ${room}`);
        });
        socket.on('send_notification', (data) => {
            // Validate sender context matches room organization to prevent cross-tenant message injection
            if (user && data.organizationId && user.organizationId !== data.organizationId) {
                logger_js_1.logger.warn(`Cross-tenant notification attempt blocked for user ${user.email}`);
                return;
            }
            io.to(data.targetRole).emit('receive_notification', data);
        });
        socket.on('disconnect', () => {
            logger_js_1.logger.info(`Socket disconnected: ${socket.id}`);
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
