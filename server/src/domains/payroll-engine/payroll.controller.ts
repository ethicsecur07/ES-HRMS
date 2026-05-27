import mongoose from 'mongoose';
import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { PayrollPipeline } from './PayrollPipeline.js';
import { PayrollRun } from '../../models/payroll/PayrollRun.js';
import { SalaryStructure } from '../../models/payroll/SalaryStructure.js';
import { FinanceExportService } from '../finance-integration/FinanceExportService.js';
import { Payroll } from '../../models/Payroll.js';
import { Payslip } from '../../models/Payslip.js';
import { Employee } from '../../models/Employee.js';
import { Organization } from '../../models/Organization.js';
import { PayslipPdfGenerator } from './services/PayslipPdfGenerator.js';

export const triggerPayrollRun = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { startCycle, endCycle, runCycle } = req.body;

    const start = startCycle || runCycle;
    const end = endCycle || runCycle;

    if (!start) {
      res.status(400).json({ message: 'runCycle or startCycle is required' });
      return;
    }

    const objectId = new mongoose.Types.ObjectId(orgId);
    
    // Trigger sequential range-based bulk processing
    const runs = await PayrollPipeline.triggerRangeProcessing(objectId, start, end);

    res.status(202).json({ 
      message: 'Payroll bulk processing triggered successfully for target period range.', 
      runs,
      run: runs[0]
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getPayrollRuns = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const runs = await PayrollRun.find({ organizationId: orgId }).sort({ createdAt: -1 });
    res.json(runs);
  } catch (err) {
    next(err);
  }
};

export const rollbackPayrollRun = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { runCycle } = req.params;

    const objectId = new mongoose.Types.ObjectId(orgId);
    const run = await PayrollPipeline.rollbackRun(objectId, runCycle);
    res.json({ message: 'Payroll run rolled back successfully', run });
  } catch (err) {
    next(err);
  }
};

export const exportFinanceJournal = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { runCycle, platform } = req.body;

    const payrolls = await Payroll.find({ organizationId: orgId, month: runCycle, paidStatus: 'PAID' });
    
    if (payrolls.length === 0) {
      res.status(400).json({ message: 'No paid payrolls found for this cycle to export.' });
      return;
    }

    const exportData = await FinanceExportService.export(platform, runCycle, payrolls);
    res.json({ message: 'Export successful', data: exportData });
  } catch (err) {
    next(err);
  }
};

export const approvePayrollRun = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { runCycle } = req.body;
    const userId = req.user?.id;

    if (!runCycle) {
      res.status(400).json({ message: 'runCycle is required' });
      return;
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const run = await PayrollPipeline.approveRun(orgObjectId, runCycle, userObjectId);

    res.json({ message: 'Payroll run approved and finalized successfully', run });
  } catch (err) {
    next(err);
  }
};

export const getPayslipPDF = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { payrollId } = req.params;

    // Fetch the payroll record
    const payroll = await Payroll.findOne({ _id: payrollId, organizationId: orgId });
    if (!payroll) {
      res.status(404).json({ message: 'Payroll record not found.' });
      return;
    }

    // Fetch employee details
    const employee = await Employee.findOne({ _id: payroll.employeeId, organizationId: orgId });
    if (!employee) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    // Fetch organization details
    const organization = await Organization.findById(orgId);
    if (!organization) {
      res.status(404).json({ message: 'Organization not found.' });
      return;
    }

    // Fetch the generated payslip details
    const payslip = await Payslip.findOne({ payrollId: payroll._id, organizationId: orgId });
    if (!payslip) {
      res.status(404).json({ message: 'Payslip record not found for this payroll. Please run payroll calculation first.' });
      return;
    }

    // Set Response Headers for PDF streaming
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${employee.employeeCode}_${payroll.month}.pdf`);

    // Generate and stream PDF to the client
    await PayslipPdfGenerator.generate(payslip, employee, organization, res);
  } catch (err) {
    next(err);
  }
};
