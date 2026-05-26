import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { PasswordService } from '../domains/auth-engine/services/PasswordService.js';
import { createAuditLog } from './auditLog.service.js';

export interface EmployeeQueryOptions {
  search?: string;
  department?: string;
  designation?: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  isActive?: string | boolean;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class EmployeeService {
  /**
   * Onboards a new employee, creates their system User account, and hashes their password atomically.
   */
  static async createEmployee(employeeData: any, password: string | undefined, orgId: mongoose.Types.ObjectId | string, emailForAudit: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!employeeData.employeeCode) {
        employeeData.employeeCode = await EmployeeService.generateNextEmployeeCode(orgId);
      }

      // 1. Pre-flight check for duplicate employeeCode or email within organization
      if (employeeData.employeeCode) {
        const codeExists = await Employee.findOne({
          organizationId: orgId,
          employeeCode: employeeData.employeeCode,
        }).session(session);
        if (codeExists) {
          throw new Error(`Employee with code ${employeeData.employeeCode} already exists in this organization.`);
        }
      }

      if (employeeData.email) {
        const normalizedEmail = employeeData.email.toLowerCase().trim();
        const emailExists = await Employee.findOne({
          organizationId: orgId,
          email: normalizedEmail,
        }).session(session);
        if (emailExists) {
          throw new Error(`Employee with email ${employeeData.email} already exists in this organization.`);
        }
      }

      // 2. Hash Password for login account
      const defaultPassword = password || 'EthicSec@2026';
      const hashedPassword = await PasswordService.hashPassword(defaultPassword);

      // 3. Create Employee record
      const [employee] = await Employee.create([{
        ...employeeData,
        organizationId: orgId,
      }], { session });

      // 4. Create corresponding login account (User)
      await User.create([{
        organizationId: orgId,
        name: employee.fullName,
        email: employee.email,
        password: hashedPassword,
        role: 'EMPLOYEE',
        employeeId: employee._id,
        isActive: true,
      }], { session });

      await createAuditLog(
        'EMPLOYEE_CREATE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Onboarded employee ${employee.fullName} and provisioned credentials.`,
        orgId
      );

      await session.commitTransaction();
      return { employee, generatedPassword: defaultPassword };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates employee record and synchronizes User credentials.
   */
  static async updateEmployee(id: string, updateData: any, orgId: mongoose.Types.ObjectId | string, emailForAudit: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { email, employeeCode } = updateData;

      // 1. Scan for duplicates when email or employeeCode is updated
      if (employeeCode) {
        const codeExists = await Employee.findOne({
          organizationId: orgId,
          employeeCode,
          _id: { $ne: id },
        }).session(session);
        if (codeExists) {
          throw new Error(`Employee with code ${employeeCode} already exists.`);
        }
      }

      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const emailExists = await Employee.findOne({
          organizationId: orgId,
          email: normalizedEmail,
          _id: { $ne: id },
        }).session(session);
        if (emailExists) {
          throw new Error(`Employee with email ${email} already exists.`);
        }
      }

      // 2. Perform the update
      const employee = await Employee.findOneAndUpdate(
        { _id: id, organizationId: orgId },
        updateData,
        { new: true, session }
      );
      if (!employee) {
        throw new Error('Employee not found or unauthorized.');
      }

      // 3. Keep corresponding User login details in sync
      const userUpdate: any = {};
      if (updateData.fullName) userUpdate.name = updateData.fullName;
      if (updateData.email) userUpdate.email = updateData.email.toLowerCase().trim();
      if (updateData.isActive !== undefined) userUpdate.isActive = updateData.isActive;

      if (Object.keys(userUpdate).length > 0) {
        await User.findOneAndUpdate(
          { employeeId: employee._id, organizationId: orgId },
          userUpdate,
          { session }
        );
      }

      await createAuditLog(
        'EMPLOYEE_UPDATE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Updated profile details for ${employee.fullName}`,
        orgId
      );

      await session.commitTransaction();
      return employee;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Retrieves list of employees with support for search, pagination, and sorting.
   */
  static async getEmployees(orgId: mongoose.Types.ObjectId | string, options: EmployeeQueryOptions = {}) {
    const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder } = options;

    const query: any = { organizationId: orgId };

    if (search) {
      const escapedSearch = String(search).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: escapedSearch, $options: 'i' } },
        { employeeCode: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (department && department !== 'All') {
      query.department = department;
    }
    if (designation) {
      query.designation = designation;
    }
    if (departmentId && departmentId !== 'All') {
      query.departmentId = departmentId;
    }
    if (designationId && designationId !== 'All') {
      query.designationId = designationId;
    }
    if (branchId) {
      query.branchId = branchId;
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 100;
    const skipNum = (pageNum - 1) * limitNum;

    // Sorting
    const sortField = sortBy || 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sortObj: any = {};
    sortObj[sortField] = sortDir;

    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .sort(sortObj)
      .skip(skipNum)
      .limit(limitNum);

    const employeeIds = employees.map(emp => emp._id);
    const users = await User.find({ employeeId: { $in: employeeIds }, organizationId: orgId }).select('_id employeeId ssoData');
    const userMap = new Map(users.map(u => [u.employeeId?.toString(), { userId: u._id.toString(), ssoData: u.ssoData }]));

    const enrichedEmployees = employees.map(emp => {
      const empObj = emp.toObject();
      const userData = userMap.get(emp._id.toString()) || null;
      return {
        ...empObj,
        userId: userData?.userId || null,
        ssoData: userData?.ssoData || null
      };
    });

    return { employees: enrichedEmployees, total, page: pageNum, limit: limitNum };
  }

  /**
   * Fetches employee details.
   */
  static async getEmployeeById(id: string, orgId: mongoose.Types.ObjectId | string) {
    const employee = await Employee.findOne({ _id: id, organizationId: orgId })
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code');
    if (!employee) {
      throw new Error('Employee not found');
    }
    const user = await User.findOne({ employeeId: employee._id, organizationId: orgId }).select('_id ssoData');
    const empObj = employee.toObject();
    return {
      ...empObj,
      userId: user?._id.toString() || null,
      ssoData: user?.ssoData || null
    };
  }

  /**
   * Soft deletes employee and their corresponding user login mapping.
   */
  static async deleteEmployee(id: string, orgId: mongoose.Types.ObjectId | string, emailForAudit: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const employee = await Employee.findOne({ _id: id, organizationId: orgId }).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // 1. Soft-delete the Employee (this updates isDeleted and deletedAt)
      await (employee as any).softDelete();

      // 2. Revoke User login (soft-delete the user if it supports it, otherwise deactivate)
      const user = await User.findOne({ employeeId: employee._id, organizationId: orgId }).session(session);
      if (user) {
        if (typeof (user as any).softDelete === 'function') {
          await (user as any).softDelete();
        } else {
          user.isActive = false;
          await user.save({ session });
        }
      }

      await createAuditLog(
        'EMPLOYEE_DELETE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Soft-deleted record and revoked user account for ${employee.fullName}`,
        orgId
      );

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generates the next sequential employee code for an organization.
   */
  static async generateNextEmployeeCode(orgId: mongoose.Types.ObjectId | string): Promise<string> {
    const employees = await Employee.find({
      organizationId: orgId,
      $or: [{ isDeleted: true }, { isDeleted: false }, { isDeleted: { $exists: false } }]
    } as any).select('employeeCode');

    let maxNum = 0;
    const prefix = 'EMP-';

    for (const emp of employees) {
      const code = emp.employeeCode;
      if (!code) continue;
      // Match a suffix pattern of digits, e.g. EMP-003 -> 3 or EMP-12 -> 12
      const match = code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `${prefix}${padded}`;
  }
}
