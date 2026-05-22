import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { EmployeeLifecycle } from '../../models/EmployeeLifecycle.js';
import { Employee } from '../../models/Employee.js';

export const getLifecycleTrackers = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, type } = req.query;

    const query: any = { organizationId: orgId };
    if (employeeId) query.employeeId = employeeId;
    if (type) query.type = type;

    const trackers = await EmployeeLifecycle.find(query)
      .populate('employeeId', 'firstName lastName designation employeeId email')
      .populate('steps.assignedTo', 'firstName lastName');

    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized(trackers);
    } else {
      res.json(trackers);
    }
  } catch (err) {
    next(err);
  }
};

export const createLifecycleTracker = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, type, startDate, probationDetails, promotionDetails, transferDetails, resignationDetails } = req.body;

    // Build default checklist steps based on workflow type
    let steps: any[] = [];
    if (type === 'ONBOARDING') {
      steps = [
        { name: 'Document submission', description: 'Collect and verify credentials, proofs, and certificates', status: 'PENDING' },
        { name: 'IT Provisioning', description: 'Handover workspace system, generate corporate email and single sign-on credentials', status: 'PENDING' },
        { name: 'HR Induction', description: 'Conduct corporate induction, align with cultural handbook and code of conduct', status: 'PENDING' },
        { name: 'Payroll & Bank Setup', description: 'Wire bank routing records and configure base salary parameters', status: 'PENDING' },
      ];
    } else if (type === 'RESIGNATION' || type === 'EXIT') {
      steps = [
        { name: 'Resignation Review', description: 'Conduct exit discussion and review transition timelines', status: 'PENDING' },
        { name: 'Knowledge Transfer', description: 'Oversee transition of credentials and hand-off of active projects', status: 'PENDING' },
        { name: 'Asset Recovery', description: 'Receive system hardware, accessories, and security badges back', status: 'PENDING' },
        { name: 'F&F Payroll Settlement', description: 'Perform full and final payroll accounts clearance', status: 'PENDING' },
      ];
    } else {
      steps = [
        { name: 'Initial Request Verification', description: 'Assess and approve basic workflow triggers', status: 'PENDING' },
        { name: 'Approval Chain Review', description: 'Review line manager and HR authorization signatures', status: 'PENDING' },
        { name: 'System Database Update', description: 'Commit changes to primary employee registries', status: 'PENDING' },
      ];
    }

    const tracker = new EmployeeLifecycle({
      organizationId: orgId,
      employeeId,
      type,
      startDate: startDate || new Date(),
      steps,
      probationDetails,
      promotionDetails,
      transferDetails,
      resignationDetails,
      status: 'INITIATED',
    });

    await tracker.save();
    res.status(201).json(tracker);
  } catch (err) {
    next(err);
  }
};

export const updateLifecycleStep = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orgId = req.user?.organizationId;
    const { trackerId, stepId } = req.params;
    const { status, notes, assignedTo } = req.body;

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const tracker = await EmployeeLifecycle.findOne({ _id: trackerId, organizationId: orgId }).session(session);
    if (!tracker) {
      res.status(404).json({ message: 'Lifecycle tracker not found' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const step = (tracker.steps as any).id(stepId);
    if (!step) {
      res.status(404).json({ message: 'Workflow step not found' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    if (status) step.status = status;
    if (notes !== undefined) step.notes = notes;
    if (assignedTo !== undefined) step.assignedTo = assignedTo;
    if (status === 'COMPLETED') {
      step.completedAt = new Date();
    }

    // Auto-update overall tracker status if all steps are done
    const allCompleted = tracker.steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED');
    if (allCompleted) {
      tracker.status = 'COMPLETED';
      tracker.completionDate = new Date();

      // Trigger automatic database updates on related Employee document if lifecycle is finalized
      const empQuery = { _id: tracker.employeeId, organizationId: orgId };
      if (tracker.type === 'PROBATION' && tracker.probationDetails?.isConfirmed) {
        await Employee.findOneAndUpdate(empQuery, { confirmationDate: new Date() }).session(session);
      } else if (tracker.type === 'PROMOTION' && tracker.promotionDetails) {
        await Employee.findOneAndUpdate(empQuery, {
          designation: tracker.promotionDetails.newRoleCode,
          salary: tracker.promotionDetails.newSalary,
        }).session(session);
      } else if (tracker.type === 'TRANSFER' && tracker.transferDetails) {
        await Employee.findOneAndUpdate(empQuery, {
          department: tracker.transferDetails.newDepartment,
          branchId: tracker.transferDetails.newBranchId,
        }).session(session);
      } else if (tracker.type === 'RESIGNATION' && tracker.status === 'COMPLETED') {
        await Employee.findOneAndUpdate(empQuery, {
          isActive: false,
          terminationDate: tracker.resignationDetails?.lastWorkingDay || new Date(),
        }).session(session);
      }
    } else {
      tracker.status = 'IN_PROGRESS';
    }

    await tracker.save({ session });
    await session.commitTransaction();
    res.json(tracker);
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

export const updateLifecycleDetails = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    const tracker = await EmployeeLifecycle.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      req.body,
      { new: true }
    );

    if (!tracker) {
      res.status(404).json({ message: 'Lifecycle tracker not found' });
      return;
    }

    res.json(tracker);
  } catch (err) {
    next(err);
  }
};
