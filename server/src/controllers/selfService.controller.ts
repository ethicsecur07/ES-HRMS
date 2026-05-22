import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ReimbursementClaim, TaxDeclaration, AttendanceCorrectionRequest } from '../models/SelfService.js';
import { Attendance } from '../models/Attendance.js';
import { OcrService } from '../domains/reimbursement/OcrService.js';
import { AuthRequest } from '../types/index.js';
import { ReimbursementPolicy } from '../models/payroll/ReimbursementPolicy.js';
import { Role } from '../models/Role.js';
import { Employee } from '../models/Employee.js';
import { WorkflowRunner } from '../domains/workflow-engine/WorkflowRunner.js';
import { WorkflowInstance } from '../models/WorkflowInstance.js';

// --- REIMBURSEMENT CLAIMS ---

export const getReimbursements = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};

    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE') {
      query.employeeId = employeeId;
    } else if (req.query.employeeId) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const claims = await ReimbursementClaim.find(query)
      .populate('employeeId', 'fullName employeeCode email department')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (err) {
    next(err);
  }
};

export const createReimbursement = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};
    const { expenseDate, amount, category, description, receiptUrl } = req.body;

    const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
    if (!targetEmployeeId) {
      res.status(400).json({ message: 'Employee ID is required.' });
      return;
    }

    // 1. Fetch active policy for this category
    const policy = await ReimbursementPolicy.findOne({
      organizationId: orgId,
      category: { $regex: new RegExp(`^${category}$`, 'i') },
      isActive: true
    });

    if (policy) {
      // 2. Validate max claim amount
      if (amount > policy.maxClaimAmount) {
        res.status(400).json({ message: `Claim amount exceeds the policy limit of ${policy.maxClaimAmount} for ${category}.` });
        return;
      }

      // 3. Validate receipt requirement
      if (amount >= policy.requireReceiptAbove && !receiptUrl) {
        res.status(400).json({ message: `Receipt is required for claims above ${policy.requireReceiptAbove} in ${category}.` });
        return;
      }

      // 4. Validate eligible roles
      if (policy.eligibleRoles && policy.eligibleRoles.length > 0) {
        const userRoleDoc = await Role.findOne({
          organizationId: orgId,
          code: req.user?.role
        });
        const isEligible = userRoleDoc && policy.eligibleRoles.some(roleId => roleId.toString() === userRoleDoc._id.toString());
        if (!isEligible) {
          res.status(403).json({ message: `Your role is not eligible to claim reimbursement under ${category} policy.` });
          return;
        }
      }
    }

    const claim = new ReimbursementClaim({
      organizationId: orgId,
      employeeId: targetEmployeeId,
      expenseDate,
      amount,
      category,
      description,
      receiptUrl,
      status: 'PENDING',
    });

    await claim.save();

    // Trigger Workflow if active template exists
    await WorkflowRunner.triggerWorkflow(
      orgId!.toString(),
      'EXPENSE_CLAIM',
      'ReimbursementClaim',
      claim.id
    );

    res.status(201).json(claim);
  } catch (err) {
    next(err);
  }
};

export const scanReceipt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { receiptUrl } = req.body;
    if (!receiptUrl) {
      res.status(400).json({ message: 'Receipt URL is required.' });
      return;
    }

    const ocrData = await OcrService.extractReceiptData(receiptUrl);
    res.json(ocrData);
  } catch (err) {
    next(err);
  }
};

export const approveReimbursement = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
      return;
    }

    const claim = await ReimbursementClaim.findOne({ _id: id, organizationId: orgId });
    if (!claim) {
      res.status(404).json({ message: 'Reimbursement claim not found.' });
      return;
    }

    // Block manual status updates if an active workflow is monitoring this reimbursement claim.
    const activeWorkflow = await WorkflowInstance.findOne({
      organizationId: orgId,
      refModel: 'ReimbursementClaim',
      refId: id,
      status: 'ACTIVE'
    });

    if (activeWorkflow) {
      res.status(400).json({
        message: 'Cannot manually approve/reject this claim. An active workflow is monitoring its status.'
      });
      return;
    }

    claim.status = status;
    claim.approvedBy = req.user?.id as any;
    if (status === 'REJECTED' && rejectionReason) {
      claim.rejectionReason = rejectionReason;
    }

    await claim.save();
    res.json(claim);
  } catch (err) {
    next(err);
  }
};

// --- TAX DECLARATIONS ---

export const getTaxDeclarations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};

    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE') {
      query.employeeId = employeeId;
    } else if (req.query.employeeId) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.financialYear) {
      query.financialYear = req.query.financialYear;
    }

    const declarations = await TaxDeclaration.find(query)
      .populate('employeeId', 'fullName employeeCode email department')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(declarations);
  } catch (err) {
    next(err);
  }
};

export const createTaxDeclaration = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};
    const { financialYear, declarationSection, declaredAmount, proofUrl } = req.body;

    const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
    if (!targetEmployeeId) {
      res.status(400).json({ message: 'Employee ID is required.' });
      return;
    }

    const declaration = new TaxDeclaration({
      organizationId: orgId,
      employeeId: targetEmployeeId,
      financialYear,
      declarationSection,
      declaredAmount,
      proofUrl,
      status: 'PENDING',
    });

    await declaration.save();

    // Trigger Workflow if active template exists
    await WorkflowRunner.triggerWorkflow(
      orgId!.toString(),
      'TAX_DECLARATION',
      'TaxDeclaration',
      declaration.id
    );

    res.status(201).json(declaration);
  } catch (err) {
    next(err);
  }
};

export const approveTaxDeclaration = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
      return;
    }

    const declaration = await TaxDeclaration.findOne({ _id: id, organizationId: orgId });
    if (!declaration) {
      res.status(404).json({ message: 'Tax declaration not found.' });
      return;
    }

    // Block manual status updates if an active workflow is monitoring this tax declaration.
    const activeWorkflow = await WorkflowInstance.findOne({
      organizationId: orgId,
      refModel: 'TaxDeclaration',
      refId: id,
      status: 'ACTIVE'
    });

    if (activeWorkflow) {
      res.status(400).json({
        message: 'Cannot manually approve/reject this tax declaration. An active workflow is monitoring its status.'
      });
      return;
    }

    declaration.status = status;
    declaration.approvedBy = req.user?.id as any;
    if (status === 'REJECTED' && rejectionReason) {
      declaration.rejectionReason = rejectionReason;
    }

    await declaration.save();
    res.json(declaration);
  } catch (err) {
    next(err);
  }
};

// --- ATTENDANCE CORRECTIONS ---

export const getAttendanceCorrections = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};

    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE') {
      query.employeeId = employeeId;
    } else if (req.query.employeeId) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const corrections = await AttendanceCorrectionRequest.find(query)
      .populate('employeeId', 'fullName employeeCode email department')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(corrections);
  } catch (err) {
    next(err);
  }
};

export const createAttendanceCorrection = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};
    const { attendanceDate, requestedLoginTime, requestedLogoutTime, reason } = req.body;

    const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
    if (!targetEmployeeId) {
      res.status(400).json({ message: 'Employee ID is required.' });
      return;
    }

    const request = new AttendanceCorrectionRequest({
      organizationId: orgId,
      employeeId: targetEmployeeId,
      attendanceDate,
      requestedLoginTime,
      requestedLogoutTime,
      reason,
      status: 'PENDING',
    });

    await request.save();

    // Trigger Workflow if active template exists
    await WorkflowRunner.triggerWorkflow(
      orgId!.toString(),
      'ATTENDANCE_CORRECTION',
      'AttendanceCorrectionRequest',
      request.id
    );

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

export const approveAttendanceCorrection = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const request = await AttendanceCorrectionRequest.findOne({ _id: id, organizationId: orgId }).session(session);
    if (!request) {
      res.status(404).json({ message: 'Attendance correction request not found.' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Block manual status updates if an active workflow is monitoring this attendance correction request.
    const activeWorkflow = await WorkflowInstance.findOne({
      organizationId: orgId,
      refModel: 'AttendanceCorrectionRequest',
      refId: id,
      status: 'ACTIVE'
    }).session(session);

    if (activeWorkflow) {
      res.status(400).json({
        message: 'Cannot manually approve/reject this request. An active workflow is monitoring its status.'
      });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    request.status = status;
    request.approvedBy = req.user?.id as any;
    if (status === 'REJECTED' && rejectionReason) {
      request.rejectionReason = rejectionReason;
    }

    // Apply corrected times to Attendance model transactionally on approval
    if (status === 'APPROVED') {
      const login = new Date(request.requestedLoginTime);
      const logout = new Date(request.requestedLogoutTime);
      const workingHours = parseFloat(((logout.getTime() - login.getTime()) / (1000 * 60 * 60)).toFixed(2));

      await Attendance.findOneAndUpdate(
        { employeeId: request.employeeId, date: request.attendanceDate, organizationId: orgId },
        {
          $setOnInsert: {
            organizationId: orgId,
            employeeId: request.employeeId,
            date: request.attendanceDate,
            ipAddress: 'CORRECTION',
            deviceInfo: 'SYSTEM_CORRECTED',
          },
          $set: {
            loginTime: login,
            logoutTime: logout,
            workingHours,
            status: 'OFFICE',
            isLate: false,
            locationVerified: true,
            overrideReason: `Time correction: ${request.reason}`,
          }
        },
        { upsert: true, new: true, session }
      );
    }

    await request.save({ session });
    await session.commitTransaction();
    res.json(request);
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};
