import { Response } from 'express';
import mongoose from 'mongoose';
import { EmployeeService } from '../services/employee.service.js';
import { AuthRequest } from '../types/index.js';

export const getNextEmployeeCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const nextCode = await EmployeeService.generateNextEmployeeCode(orgId);
    res.status(200).json({ nextCode });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const { search, department, designation, branchId, isActive, page, limit, sortBy, sortOrder } = req.query;
    const result = await EmployeeService.getEmployees(orgId, {
      search: search as string,
      department: department as string,
      designation: designation as string,
      branchId: branchId as string,
      isActive: isActive as string,
      page: page as string,
      limit: limit as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
    });

    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized(result);
    } else {
      res.status(200).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organizationId, employeeId, role } = req.user || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }

    if (!organizationId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    // Standard employee can only fetch their own profile details
    if (role === 'EMPLOYEE' && employeeId !== id) {
      res.status(403).json({ message: 'Forbidden. You can only view your own profile.' });
      return;
    }

    const employee = await EmployeeService.getEmployeeById(id, organizationId);

    // If standard employee is viewing their own profile, clear restricted fields to display all profile info
    if (role === 'EMPLOYEE' && employeeId === id) {
      (req as any).restrictedFields = [];
    }

    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized({ employee });
    } else {
      res.status(200).json({ employee });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, ...employeeData } = req.body;
    const orgId = req.user?.organizationId;
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const { employee, generatedPassword } = await EmployeeService.createEmployee(
      employeeData,
      password,
      orgId,
      emailForAudit
    );

    res.status(201).json({ employee, generatedPassword });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const employee = await EmployeeService.updateEmployee(id, req.body, orgId, emailForAudit);

    res.status(200).json({ employee });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    await EmployeeService.deleteEmployee(id, orgId, emailForAudit);

    res.status(200).json({ message: 'Employee record soft-deleted and user account revoked successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
