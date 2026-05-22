import { Request, Response } from 'express';
import { Expense } from '../models/Expense.js';
import { initiateExpenseWorkflow, processExpenseApproval } from '../services/expenseWorkflow.service.js';
import { AuthRequest } from '../types/index.js';
import { createAuditLog } from '../services/auditLog.service.js';

export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, category, reason, description, date, attachmentUrl } = req.body;

    const expense = await Expense.create({
      organizationId: req.user?.organizationId,
      submittedBy: req.user?.id,
      amount,
      category,
      reason,
      description,
      date,
      attachmentUrl
    });

    await initiateExpenseWorkflow(expense._id.toString(), req.user?.organizationId as string);

    await createAuditLog(
      'EXPENSE_CREATED',
      req.user?.email || 'System',
      'EXPENSE',
      expense.id,
      `Created expense claim for $${amount}`,
      req.user?.organizationId
    );

    res.status(201).json({ expense });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getExpenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expenses = await Expense.find({ organizationId: req.user?.organizationId })
      .populate('submittedBy', 'firstName lastName email')
      .populate('workflowInstanceId')
      .sort({ createdAt: -1 });

    res.status(200).json({ expenses });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Workflow instance ID
    const { comments } = req.body;

    await processExpenseApproval(id, req.user?.id as string, 'APPROVE', comments);

    res.status(200).json({ message: 'Expense approved successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Workflow instance ID
    const { comments } = req.body;

    await processExpenseApproval(id, req.user?.id as string, 'REJECT', comments);

    res.status(200).json({ message: 'Expense rejected successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
