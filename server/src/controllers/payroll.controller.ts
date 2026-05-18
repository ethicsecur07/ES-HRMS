import { Request, Response } from 'express';
import { Payroll } from '../models/Payroll.js';
import { calculateMonthlyPayroll } from '../services/payroll.service.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const getPayrolls = async (req: Request, res: Response): Promise<void> => {
  try {
    const payrolls = await Payroll.find().populate('employeeId').sort({ month: -1 });
    res.status(200).json({ payrolls });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  const { month } = req.body;

  try {
    const payrolls = await calculateMonthlyPayroll(month);

    await createAuditLog(
      'PAYROLL_GENERATE',
      req.user?.email || 'Admin',
      'PAYROLL',
      `Period: ${month}`,
      `Generated payroll for ${payrolls.length} employees`
    );

    res.status(200).json({ payrolls });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePayrollStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { paidStatus } = req.body;

  try {
    const payroll = await Payroll.findByIdAndUpdate(
      id,
      { paidStatus, paymentDate: paidStatus === 'PAID' ? new Date() : undefined },
      { new: true }
    ).populate('employeeId');

    if (!payroll) {
      res.status(404).json({ message: 'Payroll record not found' });
      return;
    }

    await createAuditLog(
      'PAYROLL_STATUS_UPDATE',
      req.user?.email || 'Admin',
      'PAYROLL',
      payroll.id,
      `Updated disbursement status to ${paidStatus}`
    );

    res.status(200).json({ payroll });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
