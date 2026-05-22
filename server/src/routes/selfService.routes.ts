import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
import {
  getReimbursements,
  createReimbursement,
  scanReceipt,
  approveReimbursement,
  getTaxDeclarations,
  createTaxDeclaration,
  approveTaxDeclaration,
  getAttendanceCorrections,
  createAttendanceCorrection,
  approveAttendanceCorrection,
} from '../controllers/selfService.controller.js';

const router = Router();

// Reimbursements
router.get('/reimbursements', authenticate as any, getReimbursements as any);
router.post('/reimbursements', authenticate as any, createReimbursement as any);
router.post('/reimbursements/scan', authenticate as any, scanReceipt as any);
router.put('/reimbursements/:id/approve', authenticate as any, rbacGuard('REIMBURSEMENTS', 'approve') as any, approveReimbursement as any);

// Tax Declarations
router.get('/tax-declarations', authenticate as any, getTaxDeclarations as any);
router.post('/tax-declarations', authenticate as any, createTaxDeclaration as any);
router.put('/tax-declarations/:id/approve', authenticate as any, rbacGuard('TAX_DECLARATIONS', 'approve') as any, approveTaxDeclaration as any);

// Attendance Corrections
router.get('/attendance-corrections', authenticate as any, getAttendanceCorrections as any);
router.post('/attendance-corrections', authenticate as any, createAttendanceCorrection as any);
router.put('/attendance-corrections/:id/approve', authenticate as any, rbacGuard('ATTENDANCE', 'approve') as any, approveAttendanceCorrection as any);

export default router;
