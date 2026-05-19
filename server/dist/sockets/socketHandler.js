"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSockets = void 0;
const socket_io_1 = require("socket.io");
const logger_js_1 = require("../utils/logger.js");
let ioInstance = null;
const initSockets = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    ioInstance = io;
    io.on('connection', (socket) => {
        logger_js_1.logger.info(`Socket connected: ${socket.id}`);
        socket.on('join_room', (role) => {
            socket.join(role);
            logger_js_1.logger.info(`Socket ${socket.id} joined room: ${role}`);
        });
        socket.on('send_notification', (data) => {
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
