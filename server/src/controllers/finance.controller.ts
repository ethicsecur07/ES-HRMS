import { Response } from 'express';
import { Finance } from '../models/Finance.js';
import { FinanceConfig } from '../models/FinanceConfig.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const getFinanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await Finance.find({ organizationId: req.user?.organizationId }).sort({ date: -1, createdAt: -1 });

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
    const orgId = req.user?.organizationId;
    
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const numericAmount = Number(amount);

    // Rule validation
    if (type === 'EXPENSE') {
      const config = await FinanceConfig.findOne({ organizationId: orgId });
      const maxLimit = config?.rules?.maxExpenseLimit ?? 50000;
      if (numericAmount > maxLimit) {
        res.status(400).json({ message: `Expense exceeds maximum allowed limit of $${maxLimit}.` });
        return;
      }
    }

    const loggedBy = req.user ? `${req.user.email} (${req.user.role})` : 'System';

    const record = await Finance.create({
      organizationId: orgId,
      type,
      amount: numericAmount,
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
      `${type === 'ALLOCATION' ? 'Allocated budget' : 'Logged expense'}: $${amount} for ${categoryOrReason}`,
      orgId
    );

    res.status(201).json({ record });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getFinanceConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    let config = await FinanceConfig.findOne({ organizationId: orgId });
    if (!config) {
      config = new FinanceConfig({ organizationId: orgId });
      await config.save();
    }
    res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFinanceConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const { budgetCategories, expenseTypes, approvalWorkflow, rules } = req.body;
    let config = await FinanceConfig.findOne({ organizationId: orgId });
    if (!config) {
      config = new FinanceConfig({ organizationId: orgId });
    }
    if (budgetCategories !== undefined) config.budgetCategories = budgetCategories;
    if (expenseTypes !== undefined) config.expenseTypes = expenseTypes;
    if (approvalWorkflow !== undefined) config.approvalWorkflow = approvalWorkflow;
    if (rules !== undefined) config.rules = rules;

    await config.save();
    res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
