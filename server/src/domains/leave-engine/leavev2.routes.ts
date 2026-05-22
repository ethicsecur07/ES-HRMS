/**
 * leavev2.routes.ts
 * ------------------
 * Enterprise leave V2 routes with RBAC guard.
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/auth.middleware.js';
import {
  getLeaveV2Summary,
  runAutomatedAccruals,
  checkSandwichRule,
  submitEncashment,
  getLeaveAnalytics,
  getMyLeaveBalances,
  getEmployeeLeaveBalances,
} from './leavev2.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Summary and analytics (ADMIN/HR)
router.get('/summary', authorize(['ADMIN', 'HR']) as any, getLeaveV2Summary as any);
router.get('/analytics', authorize(['ADMIN', 'HR']) as any, getLeaveAnalytics as any);

// Accrual trigger (ADMIN only)
router.post('/accrue', authorize(['ADMIN']) as any, runAutomatedAccruals as any);

// Sandwich rule check (any authenticated user)
router.post('/sandwich-check', checkSandwichRule as any);

// Encashment request (any authenticated employee)
router.post('/encash', submitEncashment as any);

// ── Leave Balance Self-Service ────────────────────────────────────────────
// Employee: view own balances (enriched with policy meta)
router.get('/balance/me', getMyLeaveBalances as any);

// Admin/HR: view balances for a specific employee
router.get('/balance/:empId', authorize(['ADMIN', 'HR']) as any, getEmployeeLeaveBalances as any);

export default router;
