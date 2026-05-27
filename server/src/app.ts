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
import v2PayrollRoutes from './domains/payroll-engine/payroll.routes.js';
import v2LeaveRoutes from './domains/leave-engine/leavev2.routes.js';

import { securityHeaders, secureMiddleware } from './middlewares/helmetEnhancements.js';
import { cspHeaders } from './middlewares/cspHeaders.js';

import { initSentry } from './utils/sentry.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { metricsMiddleware } from './middlewares/metrics';
import v2AuthRoutes from './domains/auth-engine/auth-engine.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import taskRoutes from './routes/task.routes.js';
import financeRoutes from './routes/finance.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import organizationRoutes from './domains/organization/organization.routes.js';
import moduleRoutes from './routes/module.routes.js';
import advancedAttendanceRoutes from './domains/attendance-engine/attendance.routes.js';
import documentRoutes from './routes/document.routes.js';
import roleRoutes from './routes/role.routes.js';
import assetRoutes from './routes/asset.routes.js';
import authPermissionRoutes from './routes/authPermission.routes.js';
import departmentRoutes from './routes/department.routes.js';
import designationRoutes from './routes/designation.routes.js';
import holidayCalendarRoutes from './routes/holidayCalendar.routes.js';
import leavePolicyRoutes from './routes/leavePolicy.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import projectRoutes from './domains/project-management/project.routes.js';
import recruitmentRoutes from './domains/recruitment/recruitment.routes.js';
import chatRoutes from './domains/chat/chat.routes.js';
import notificationRoutes from './domains/notification/notification.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import payrollConfigRoutes from './routes/payrollConfig.routes.js';

import { errorHandler } from './middlewares/errorHandler.js';
import { traceIdMiddleware } from './middlewares/traceId.js';
import { responseFormatter } from './middlewares/responseFormatter.js';

import { getTenantConfig } from './controllers/auth.controller.js';

export const createApp = (): Application => {
  const app = express();

  // Security & Utility Middlewares
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(traceIdMiddleware);
  app.use(responseFormatter);
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

// Initialize Sentry for error monitoring
initSentry();

// Security middlewares
app.use(securityHeaders);
app.use(cspHeaders);
app.use(secureMiddleware);

// Metrics endpoint

app.use('/metrics', metricsMiddleware);

  app.get('/api/public/organization-config/:slug', getTenantConfig as any);
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/attendance', advancedAttendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/wfh', wfhRoutes);
  app.use('/api/payrolls', payrollRoutes); // Legacy
  app.use('/api/v2/payroll', v2PayrollRoutes); // Enterprise Engine
  app.use('/api/payroll-config', payrollConfigRoutes); // Payroll Setup Config
  app.use('/api/projects', projectRoutes);
  app.use('/api/recruitment', recruitmentRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/v2/auth', v2AuthRoutes); // Enterprise Auth & SSO Engine
  app.use('/api/v2/leave', v2LeaveRoutes); // Enterprise Leave Engine V2
  app.use('/api/finance', financeRoutes);
  app.use('/api/expenses', expenseRoutes);

  app.use('/api/upload', uploadRoutes);
  app.use('/api/organization', organizationRoutes);
  app.use('/api/modules', moduleRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/auth-permissions', authPermissionRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/designations', designationRoutes);
  app.use('/api/holiday-calendar', holidayCalendarRoutes);
  app.use('/api/leave-policies', leavePolicyRoutes);

  // Healthcheck Route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
