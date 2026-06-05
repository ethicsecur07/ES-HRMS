"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const app_js_1 = require("./app.js");
const db_js_1 = require("./config/db.js");
const socketHandler_js_1 = require("./sockets/socketHandler.js");
const cronJobs_js_1 = require("./jobs/cronJobs.js");
const logger_js_1 = require("./utils/logger.js");
const subscribers_js_1 = require("./events/subscribers.js");
dotenv_1.default.config();
const startServer = async () => {
    const app = (0, app_js_1.createApp)();
    const server = http_1.default.createServer(app);
    // Initialize Core Services
    await (0, db_js_1.connectDB)();
    (0, socketHandler_js_1.initSockets)(server);
    (0, subscribers_js_1.registerSubscribers)();
    (0, cronJobs_js_1.initCronJobs)();
    const PORT = process.env.PORT || 5000;
    server.listen(Number(PORT), () => {
        logger_js_1.logger.info(`🚀 Enterprise HRMS Backend Server running on port ${PORT}`);
    });
    // Graceful shutdown handling
    const shutdown = () => {
        logger_js_1.logger.info('Shutting down server gracefully...');
        server.close(() => {
            logger_js_1.logger.info('Server closed.');
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};
startServer();
