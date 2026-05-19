import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import wfhRoutes from './routes/wfh.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import taskRoutes from './routes/task.routes.js';
import financeRoutes from './routes/finance.routes.js';
import uploadRoutes from './routes/upload.routes.js';

import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const createApp = (): Application => {
  const app = express();

  // Security & Utility Middlewares
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(apiRateLimiter);

  // Disable ETags and Browser Caching to ensure fresh 200 OK responses
  app.set('etag', false);
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/wfh', wfhRoutes);
  app.use('/api/payrolls', payrollRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/upload', uploadRoutes);

  // Healthcheck Route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
