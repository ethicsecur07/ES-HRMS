import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { Employee } from '../models/Employee.js';
import { AuthRequest } from '../types/index.js';

export const getDocuments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};

    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE') {
      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
        query.employeeId = employeeId;
      } else {
        res.status(400).json({ message: 'Invalid or missing employee context in session.' });
        return;
      }
    } else if (req.query.employeeId && mongoose.Types.ObjectId.isValid(req.query.employeeId as string)) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    const documents = await EmployeeDocument.find(query)
      .populate('employeeId', 'fullName employeeCode email department')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (err) {
    next(err);
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId: userEmpId, role, id: userId } = req.user || {};
    const { employeeId: targetEmpId, name, category, fileUrl } = req.body;

    const finalTargetEmpId = role === 'EMPLOYEE' ? userEmpId : targetEmpId;
    if (!finalTargetEmpId) {
      res.status(400).json({ message: 'Employee ID is required.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(finalTargetEmpId)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }

    // Enforce that target employee belongs to the same organization
    const targetEmployee = await Employee.findOne({ _id: finalTargetEmpId, organizationId: orgId });
    if (!targetEmployee) {
      res.status(400).json({ message: 'Target employee not found in this organization.' });
      return;
    }

    const document = new EmployeeDocument({
      organizationId: orgId,
      employeeId: finalTargetEmpId,
      name,
      category,
      fileUrl,
      uploadedBy: userId,
    });

    await document.save();
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
};

export const addDocumentVersion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Bypassed for EmployeeDocument flat structure, keeping signature compatibility
  res.status(200).json({ message: 'Versioning is not supported for flat employee documents.' });
};

export const downloadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid document ID format.' });
      return;
    }

    const document = await EmployeeDocument.findOne({ _id: id, organizationId: orgId });
    if (!document) {
      res.status(404).json({ message: 'Document not found.' });
      return;
    }

    // If standard employee, check that they own this document
    if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
      res.status(403).json({ message: 'Forbidden. You do not have access to this document.' });
      return;
    }

    res.json({
      name: document.name,
      fileUrl: document.fileUrl,
      category: document.category,
      version: 1,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid document ID format.' });
      return;
    }

    const result = await EmployeeDocument.deleteOne({ _id: id, organizationId: orgId });
    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Document not found.' });
      return;
    }

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
