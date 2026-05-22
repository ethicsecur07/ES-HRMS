import { Response, NextFunction } from 'express';
import { HRDocument } from '../models/HRDocument.js';
import { Employee } from '../models/Employee.js';
import { AuthRequest } from '../types/index.js';

export const getDocuments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};

    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE') {
      query.employeeId = employeeId;
    } else if (req.query.employeeId) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    const documents = await HRDocument.find(query)
      .populate('employeeId', 'fullName employeeCode email department')
      .populate('versions.uploadedBy', 'name email')
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
    const { employeeId: targetEmpId, name, category, fileUrl, expiresAt, signatureStatus } = req.body;

    const finalTargetEmpId = role === 'EMPLOYEE' ? userEmpId : targetEmpId;
    if (!finalTargetEmpId) {
      res.status(400).json({ message: 'Employee ID is required.' });
      return;
    }

    // Enforce that target employee belongs to the same organization
    const targetEmployee = await Employee.findOne({ _id: finalTargetEmpId, organizationId: orgId });
    if (!targetEmployee) {
      res.status(400).json({ message: 'Target employee not found in this organization.' });
      return;
    }

    const document = new HRDocument({
      organizationId: orgId,
      employeeId: finalTargetEmpId,
      name,
      category,
      fileUrl,
      version: 1,
      expiresAt,
      signatureStatus: signatureStatus || 'NOT_REQUIRED',
      versions: [{
        version: 1,
        fileUrl,
        uploadedAt: new Date(),
        uploadedBy: userId,
      }],
      isActive: true,
    });

    await document.save();
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
};

export const addDocumentVersion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role, id: userId } = req.user || {};
    const { id } = req.params;
    const { fileUrl } = req.body;

    if (!fileUrl) {
      res.status(400).json({ message: 'File URL is required.' });
      return;
    }

    const document = await HRDocument.findOne({ _id: id, organizationId: orgId });
    if (!document) {
      res.status(404).json({ message: 'Document not found.' });
      return;
    }

    // If standard employee, check that they own this document
    if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
      res.status(403).json({ message: 'Forbidden. You do not own this document.' });
      return;
    }

    const nextVersion = document.version + 1;
    document.version = nextVersion;
    document.fileUrl = fileUrl;
    document.versions.push({
      version: nextVersion,
      fileUrl,
      uploadedAt: new Date(),
      uploadedBy: userId as any,
    });

    await document.save();
    res.json(document);
  } catch (err) {
    next(err);
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, role } = req.user || {};
    const { id } = req.params;

    const document = await HRDocument.findOne({ _id: id, organizationId: orgId });
    if (!document) {
      res.status(404).json({ message: 'Document not found.' });
      return;
    }

    // If standard employee, check that they own this document
    if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
      res.status(403).json({ message: 'Forbidden. You do not have access to this document.' });
      return;
    }

    // Return direct download url or secure access payload
    res.json({
      name: document.name,
      fileUrl: document.fileUrl,
      category: document.category,
      version: document.version,
    });
  } catch (err) {
    next(err);
  }
};
