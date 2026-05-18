import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { Leave } from '../models/Leave.js';
import { Payroll } from '../models/Payroll.js';
import { Permission } from '../models/Permission.js';
import { TaskReport } from '../models/TaskReport.js';
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
    const { password, ...employeeData } = req.body;
    const employee = await Employee.create(employeeData);

    const defaultPassword = password || 'EthicSec@2026';
    await User.create({
      name: employee.fullName,
      email: employee.email,
      password: defaultPassword,
      role: 'EMPLOYEE',
      employeeId: employee._id,
      isActive: true,
    });

    await createAuditLog(
      'EMPLOYEE_CREATE',
      req.user?.email || 'System',
      'EMPLOYEE',
      employee.employeeCode,
      `Onboarded employee ${employee.fullName}`
    );

    res.status(201).json({ employee });
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

    await Promise.all([
      User.findOneAndDelete({ $or: [{ employeeId: req.params.id }, { email: employee.email }] }),
      Attendance.deleteMany({ employeeId: req.params.id }),
      Leave.deleteMany({ employeeId: req.params.id }),
      Payroll.deleteMany({ employeeId: req.params.id }),
      Permission.deleteMany({ employeeId: req.params.id }),
      TaskReport.deleteMany({ employeeId: req.params.id }),
    ]);

    await createAuditLog(
      'EMPLOYEE_DELETE',
      req.user?.email || 'System',
      'EMPLOYEE',
      employee.employeeCode,
      `Deleted record and user account for ${employee.fullName}`
    );

    res.status(200).json({ message: 'Employee, user account, and all associated records deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
