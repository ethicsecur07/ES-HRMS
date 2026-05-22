/**
 * leave.routes.ts (REFACTORED)
 * ------------------------------
 * Adds:
 *   - POST /:id/cancel — leave cancellation with balance restoration
 *   - GET / — with query filter support (status, leaveType)
 *   - Proper authorization: EMPLOYEE can only cancel own leaves
 *   - ADMIN/HR required for status updates
 */

import { Router } from 'express';
import { applyLeave, getLeaves, updateLeaveStatus, cancelLeave } from '../controllers/leave.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Apply for leave (any authenticated user)
router.post('/apply', applyLeave as any);

// Get leaves (scoped by role in controller)
router.get('/', getLeaves as any);

// Update leave status (ADMIN/HR only)
router.put('/:id/status', authorize(['ADMIN', 'HR']) as any, updateLeaveStatus as any);

// Cancel a leave (own leave for EMPLOYEE; any for ADMIN/HR)
router.post('/:id/cancel', cancelLeave as any);

export default router;
