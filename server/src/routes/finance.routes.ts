import express from 'express';
import { getFinanceSummary, addFinanceRecord } from '../controllers/finance.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate as any);
router.use(authorize(['ADMIN', 'HR']) as any);

router.get('/', getFinanceSummary as any);
router.post('/', addFinanceRecord as any);

export default router;
