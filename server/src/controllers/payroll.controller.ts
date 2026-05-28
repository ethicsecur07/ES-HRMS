import { Request, Response } from 'express';
import { Payroll } from '../models/Payroll.js';
import { calculateMonthlyPayroll } from '../services/payroll.service.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';
import { PayrollRun } from '../models/payroll/PayrollRun.js';
import { Payslip } from '../models/Payslip.js';
import { generatePayslipPdf } from '../services/payslipPdf.service.js';

export const getPayrolls = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const payrolls = await Payroll.find({ organizationId: authReq.user?.organizationId })
      .populate('employeeId')
      .sort({ month: -1 });
    res.status(200).json({ payrolls });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  const { month } = req.body;

  try {
    const payrolls = await calculateMonthlyPayroll(month, req.user?.organizationId as string);

    await createAuditLog(
      'PAYROLL_GENERATE',
      req.user?.email || 'Admin',
      'PAYROLL',
      `Period: ${month}`,
      `Generated payroll for ${payrolls.length} employees`,
      req.user?.organizationId
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
    const payroll = await Payroll.findOne({ _id: id, organizationId: req.user?.organizationId });
    if (!payroll) {
      res.status(404).json({ message: 'Payroll record not found' });
      return;
    }

    // Check if the cycle is locked or completed
    const run = await PayrollRun.findOne({
      organizationId: req.user?.organizationId,
      runCycle: payroll.month
    });

    // Allow manual status updates when LOCKED (since payment disbursement happens when LOCKED), 
    // but prevent changes once the entire run is COMPLETED (fully finalized and paid).
    if (run && run.status === 'COMPLETED') {
      res.status(400).json({ message: `Cannot modify individual payroll status when the run cycle is COMPLETED.` });
      return;
    }

    payroll.paidStatus = paidStatus;
    payroll.paymentDate = paidStatus === 'PAID' ? new Date() : undefined;
    await payroll.save();

    await createAuditLog(
      'PAYROLL_STATUS_UPDATE',
      req.user?.email || 'Admin',
      'PAYROLL',
      payroll.id,
      `Updated disbursement status to ${paidStatus}`,
      req.user?.organizationId
    );

    res.status(200).json({ payroll });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPayslipPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params; // payrollId
  try {
    const payslip = await Payslip.findOne({ payrollId: id, organizationId: req.user?.organizationId });
    if (!payslip) {
      res.status(404).json({ message: 'Payslip not found' });
      return;
    }

    const pdfBuffer = await generatePayslipPdf(payslip);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslip.month}.pdf`);
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
