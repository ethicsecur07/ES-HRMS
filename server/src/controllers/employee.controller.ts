import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.status(200).json({ employees });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }
    res.status(200).json({ employee });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.create(req.body);

    const defaultPassword = 'EthicSec@2026';
    await User.create({
      name: employee.fullName,
      email: employee.email,
      password: defaultPassword,
      role: 'EMPLOYEE',
      employeeId: employee._id,
      isActive: true,
    });

    await createAuditLog(
      'EMPLOYEE_ONBOARD',
      req.user?.email || 'System',
      'EMPLOYEE',
      employee.employeeCode,
      `Onboarded ${employee.fullName} & generated credentials`
    );

    res.status(201).json({ employee, generatedPassword: defaultPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    await createAuditLog(
      'EMPLOYEE_UPDATE',
      req.user?.email || 'System',
      'EMPLOYEE',
      employee.employeeCode,
      `Updated profile for ${employee.fullName}`
    );

    res.status(200).json({ employee });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    await createAuditLog(
      'EMPLOYEE_DELETE',
      req.user?.email || 'System',
      'EMPLOYEE',
      employee.employeeCode,
      `Deleted record for ${employee.fullName}`
    );

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
