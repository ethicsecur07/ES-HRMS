import { Request, Response } from 'express';
import { Expense } from '../models/Expense.js';
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
      attachmentUrl,
      status: 'PENDING'
    });

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
      .sort({ createdAt: -1 });

    res.status(200).json({ expenses });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Expense ID
    const { comments } = req.body;

    const expense = await Expense.findOne({ _id: id, organizationId: req.user?.organizationId });
    if (!expense) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }

    if (expense.status !== 'PENDING') {
      res.status(400).json({ message: `Expense is already ${expense.status.toLowerCase()}` });
      return;
    }

    expense.status = 'APPROVED';
    expense.approvedBy = req.user?.id as any;
    if (comments) {
      expense.description = expense.description 
        ? `${expense.description}\n[Approval Comment]: ${comments}` 
        : `[Approval Comment]: ${comments}`;
    }
    await expense.save();

    await createAuditLog(
      'EXPENSE_APPROVED',
      req.user?.email || 'System',
      'EXPENSE',
      expense.id,
      `Approved expense claim for $${expense.amount}`,
      req.user?.organizationId
    );

    res.status(200).json({ message: 'Expense approved successfully', expense });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Expense ID
    const { comments } = req.body;

    const expense = await Expense.findOne({ _id: id, organizationId: req.user?.organizationId });
    if (!expense) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }

    if (expense.status !== 'PENDING') {
      res.status(400).json({ message: `Expense is already ${expense.status.toLowerCase()}` });
      return;
    }

    expense.status = 'REJECTED';
    expense.approvedBy = req.user?.id as any;
    if (comments) {
      expense.description = expense.description 
        ? `${expense.description}\n[Rejection Comment]: ${comments}` 
        : `[Rejection Comment]: ${comments}`;
    }
    await expense.save();

    await createAuditLog(
      'EXPENSE_REJECTED',
      req.user?.email || 'System',
      'EXPENSE',
      expense.id,
      `Rejected expense claim for $${expense.amount}. Reason: ${comments || 'None'}`,
      req.user?.organizationId
    );

    res.status(200).json({ message: 'Expense rejected successfully', expense });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
