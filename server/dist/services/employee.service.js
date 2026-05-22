"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const PasswordService_js_1 = require("../domains/auth-engine/services/PasswordService.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
class EmployeeService {
    /**
     * Onboards a new employee, creates their system User account, and hashes their password atomically.
     */
    static async createEmployee(employeeData, password, orgId, emailForAudit) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            if (!employeeData.employeeCode) {
                employeeData.employeeCode = await EmployeeService.generateNextEmployeeCode(orgId);
            }
            // 1. Pre-flight check for duplicate employeeCode or email within organization
            if (employeeData.employeeCode) {
                const codeExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    employeeCode: employeeData.employeeCode,
                }).session(session);
                if (codeExists) {
                    throw new Error(`Employee with code ${employeeData.employeeCode} already exists in this organization.`);
                }
            }
            if (employeeData.email) {
                const normalizedEmail = employeeData.email.toLowerCase().trim();
                const emailExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    email: normalizedEmail,
                }).session(session);
                if (emailExists) {
                    throw new Error(`Employee with email ${employeeData.email} already exists in this organization.`);
                }
            }
            // 2. Hash Password for login account
            const defaultPassword = password || 'EthicSec@2026';
            const hashedPassword = await PasswordService_js_1.PasswordService.hashPassword(defaultPassword);
            // 3. Create Employee record
            const [employee] = await Employee_js_1.Employee.create([{
                    ...employeeData,
                    organizationId: orgId,
                }], { session });
            // 4. Create corresponding login account (User)
            await User_js_1.User.create([{
                    organizationId: orgId,
                    name: employee.fullName,
                    email: employee.email,
                    password: hashedPassword,
                    role: 'EMPLOYEE',
                    employeeId: employee._id,
                    isActive: true,
                }], { session });
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_CREATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Onboarded employee ${employee.fullName} and provisioned credentials.`, orgId);
            await session.commitTransaction();
            return { employee, generatedPassword: defaultPassword };
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Updates employee record and synchronizes User credentials.
     */
    static async updateEmployee(id, updateData, orgId, emailForAudit) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const { email, employeeCode } = updateData;
            // 1. Scan for duplicates when email or employeeCode is updated
            if (employeeCode) {
                const codeExists = await Employee_js_1.Employee.findOne({
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
                const emailExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    email: normalizedEmail,
                    _id: { $ne: id },
                }).session(session);
                if (emailExists) {
                    throw new Error(`Employee with email ${email} already exists.`);
                }
            }
            // 2. Perform the update
            const employee = await Employee_js_1.Employee.findOneAndUpdate({ _id: id, organizationId: orgId }, updateData, { new: true, session });
            if (!employee) {
                throw new Error('Employee not found or unauthorized.');
            }
            // 3. Keep corresponding User login details in sync
            const userUpdate = {};
            if (updateData.fullName)
                userUpdate.name = updateData.fullName;
            if (updateData.email)
                userUpdate.email = updateData.email.toLowerCase().trim();
            if (updateData.isActive !== undefined)
                userUpdate.isActive = updateData.isActive;
            if (Object.keys(userUpdate).length > 0) {
                await User_js_1.User.findOneAndUpdate({ employeeId: employee._id, organizationId: orgId }, userUpdate, { session });
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_UPDATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Updated profile details for ${employee.fullName}`, orgId);
            await session.commitTransaction();
            return employee;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Retrieves list of employees with support for search, pagination, and sorting.
     */
    static async getEmployees(orgId, options = {}) {
        const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder } = options;
        const query = { organizationId: orgId };
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
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const skipNum = (pageNum - 1) * limitNum;
        // Sorting
        const sortField = sortBy || 'createdAt';
        const sortDir = sortOrder === 'asc' ? 1 : -1;
        const sortObj = {};
        sortObj[sortField] = sortDir;
        const total = await Employee_js_1.Employee.countDocuments(query);
        const employees = await Employee_js_1.Employee.find(query)
            .populate('departmentId', 'name code')
            .populate('designationId', 'name code')
            .sort(sortObj)
            .skip(skipNum)
            .limit(limitNum);
        return { employees, total, page: pageNum, limit: limitNum };
    }
    /**
     * Fetches employee details.
     */
    static async getEmployeeById(id, orgId) {
        const employee = await Employee_js_1.Employee.findOne({ _id: id, organizationId: orgId })
            .populate('departmentId', 'name code')
            .populate('designationId', 'name code');
        if (!employee) {
            throw new Error('Employee not found');
        }
        return employee;
    }
    /**
     * Soft deletes employee and their corresponding user login mapping.
     */
    static async deleteEmployee(id, orgId, emailForAudit) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const employee = await Employee_js_1.Employee.findOne({ _id: id, organizationId: orgId }).session(session);
            if (!employee) {
                throw new Error('Employee not found');
            }
            // 1. Soft-delete the Employee (this updates isDeleted and deletedAt)
            await employee.softDelete();
            // 2. Revoke User login (soft-delete the user if it supports it, otherwise deactivate)
            const user = await User_js_1.User.findOne({ employeeId: employee._id, organizationId: orgId }).session(session);
            if (user) {
                if (typeof user.softDelete === 'function') {
                    await user.softDelete();
                }
                else {
                    user.isActive = false;
                    await user.save({ session });
                }
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_DELETE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Soft-deleted record and revoked user account for ${employee.fullName}`, orgId);
            await session.commitTransaction();
            return true;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Generates the next sequential employee code for an organization.
     */
    static async generateNextEmployeeCode(orgId) {
        const employees = await Employee_js_1.Employee.find({
            organizationId: orgId,
            $or: [{ isDeleted: true }, { isDeleted: false }, { isDeleted: { $exists: false } }]
        }).select('employeeCode');
        let maxNum = 0;
        const prefix = 'EMP-';
        for (const emp of employees) {
            const code = emp.employeeCode;
            if (!code)
                continue;
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
exports.EmployeeService = EmployeeService;
