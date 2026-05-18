import { Request, Response } from 'express';
import { Finance } from '../models/Finance.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const getFinanceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const records = await Finance.find().sort({ date: -1, createdAt: -1 });

    let totalAllocated = 0;
    let totalSpent = 0;

    records.forEach((r) => {
      if (r.type === 'ALLOCATION') {
        totalAllocated += r.amount;
      } else {
        totalSpent += r.amount;
      }
    });

    res.status(200).json({
      summary: {
        totalAllocated,
        totalSpent,
        remainingBalance: totalAllocated - totalSpent,
      },
      records,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addFinanceRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, amount, categoryOrReason, description, date } = req.body;
    const loggedBy = req.user ? `${req.user.email} (${req.user.role})` : 'System';

    const record = await Finance.create({
      type,
      amount: Number(amount),
      categoryOrReason,
      description,
      date,
      loggedBy,
    });

    await createAuditLog(
      type === 'ALLOCATION' ? 'FINANCE_ALLOCATION' : 'FINANCE_EXPENSE',
      req.user?.email || 'System',
      'FINANCE',
      type,
      `${type === 'ALLOCATION' ? 'Allocated budget' : 'Logged expense'}: $${amount} for ${categoryOrReason}`
    );

    res.status(201).json({ record });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
