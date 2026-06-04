import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

import { initSockets } from './sockets/socketHandler.js';
import { initCronJobs } from './jobs/cronJobs.js';
import { logger } from './utils/logger.js';
import { registerSubscribers } from './events/subscribers.js';

dotenv.config();

const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Core Services
  await connectDB();

  initSockets(server);
  registerSubscribers();
  initCronJobs();


  const PORT = process.env.PORT || 5000;

  server.listen(Number(PORT), () => {
    logger.info(`🚀 Enterprise HRMS Backend Server running on port ${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    logger.info('Shutting down server gracefully...');
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
