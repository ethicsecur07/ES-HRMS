import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createExpense,
  getExpenses,
  approveExpense,
  rejectExpense
} from '../controllers/expense.controller.js';

const router = Router();

router.use(authenticate as any);

router.post('/', createExpense);
router.get('/', getExpenses);
router.post('/workflow/:id/approve', approveExpense);
router.post('/workflow/:id/reject', rejectExpense);

export default router;
