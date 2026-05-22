"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRolePermissions = exports.seedDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const Department_js_1 = require("../models/Department.js");
const Attendance_js_1 = require("../models/Attendance.js");
const Leave_js_1 = require("../models/Leave.js");
const Payroll_js_1 = require("../models/Payroll.js");
const PermissionRequest_js_1 = require("../models/PermissionRequest.js");
const TaskReport_js_1 = require("../models/TaskReport.js");
const Finance_js_1 = require("../models/Finance.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const Organization_js_1 = require("../models/Organization.js");
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
const Role_js_1 = require("../models/Role.js");
const Permission_js_1 = require("../models/Permission.js");
const Designation_js_1 = require("../models/Designation.js");
const LeavePolicy_js_1 = require("../models/LeavePolicy.js");
const logger_js_1 = require("../utils/logger.js");
const index_js_1 = require("../constants/index.js");
const PasswordService_js_1 = require("../domains/auth-engine/services/PasswordService.js");
const seedDatabase = async () => {
    try {
        const orgId = new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79000');
        const adminExists = await User_js_1.User.findOne({ email: /official@ethicsecur\.co\.in/i, organizationId: orgId });
        const empExists = await Employee_js_1.Employee.findOne({ email: 'logapriyan@ethicsec.com', organizationId: orgId });
        if (adminExists && empExists) {
            logger_js_1.logger.info('Database already contains enterprise records with permanent Admin, HR, and Employee. Checking/migrating plain-text passwords...');
            const usersToVerify = [
                { email: 'official@ethicsecur.co.in', defaultPass: 'Ethicsecur@2024' },
                { email: 'oviya@ethicsecur.com', defaultPass: 'Ovi@2003' },
                { email: 'logapriyan@ethicsec.com', defaultPass: 'EthicSec@2026' },
            ];
            for (const u of usersToVerify) {
                const userRecord = await User_js_1.User.findOne({ email: u.email, organizationId: orgId }).select('+password');
                if (userRecord && userRecord.password && !userRecord.password.startsWith('$argon2') && !userRecord.password.startsWith('$2')) {
                    logger_js_1.logger.info(`Fixing plain-text password for seeded user: ${u.email}`);
                    userRecord.password = await PasswordService_js_1.PasswordService.hashPassword(u.defaultPass);
                    await userRecord.save();
                }
            }
            await (0, exports.syncRolePermissions)(orgId);
            return;
        }
        logger_js_1.logger.info('🌱 Initializing Database Auto-Seeder: Cleaning all collections and seeding multi-tenant structure...');
        // 1. Clean all collections
        await Promise.all([
            Organization_js_1.Organization.deleteMany({}),
            OrganizationAuthConfig_js_1.OrganizationAuthConfig.deleteMany({}),
            Role_js_1.Role.deleteMany({}),
            Permission_js_1.Permission.deleteMany({}),
            Designation_js_1.Designation.deleteMany({}),
            LeavePolicy_js_1.LeavePolicy.deleteMany({}),
            User_js_1.User.deleteMany({}),
            Employee_js_1.Employee.deleteMany({}),
            Department_js_1.Department.deleteMany({}),
            Attendance_js_1.Attendance.deleteMany({}),
            Leave_js_1.Leave.deleteMany({}),
            Payroll_js_1.Payroll.deleteMany({}),
            PermissionRequest_js_1.PermissionRequest.deleteMany({}),
            TaskReport_js_1.TaskReport.deleteMany({}),
            Finance_js_1.Finance.deleteMany({}),
            AuditLog_js_1.AuditLog.deleteMany({}),
        ]);
        logger_js_1.logger.info('🗑️ Successfully deleted legacy data across all collections.');
        // 2. Seed Default Organization
        const defaultOrg = await Organization_js_1.Organization.create({
            _id: orgId,
            name: 'EthicSecur Global',
            slug: 'ethicsecur',
            sector: 'IT',
            isActive: true,
            settings: {
                monthlyLeaveLimit: 2,
                monthlyWFHLimit: 1,
                monthlyPermissionHours: 3,
                allowedIPs: ['127.0.0.1', '::1', '192.168.29.50', '192.168.29.55'],
            },
        });
        logger_js_1.logger.info('✅ Seeded Default Organization (EthicSecur Global).');
        // 3. Seed Default Auth Config for local auth
        await OrganizationAuthConfig_js_1.OrganizationAuthConfig.create({
            organizationId: orgId,
            provider: 'LOCAL',
            isEnabled: true,
        });
        logger_js_1.logger.info('✅ Seeded Local Authentication Provider Config.');
        // 4. Seed Core Roles
        const rolesData = [
            { organizationId: orgId, name: 'System Administrator', code: 'ADMIN', slug: 'admin', description: 'Complete system dashboard management' },
            { organizationId: orgId, name: 'Operations Manager', code: 'MANAGER', slug: 'manager', description: 'Operations & Department Manager' },
            { organizationId: orgId, name: 'HR Manager', code: 'HR', slug: 'hr', description: 'Human Resource onboarding & payroll manager' },
            { organizationId: orgId, name: 'Team Lead', code: 'TEAM_LEAD', slug: 'team-lead', description: 'Team Lead for project operations' },
            { organizationId: orgId, name: 'General Employee', code: 'EMPLOYEE', slug: 'employee', description: 'Core work logs & self service' },
        ];
        await Role_js_1.Role.bulkWrite(rolesData.map((role) => ({
            updateOne: {
                filter: { organizationId: orgId, code: role.code },
                update: { $set: role },
                upsert: true,
            },
        })));
        logger_js_1.logger.info('✅ Seeded Core Roles (ADMIN, MANAGER, HR, TEAM_LEAD, EMPLOYEE).');
        // 5. Seed Leave Policies
        const leavePoliciesData = [
            { organizationId: orgId, leaveType: 'Casual Leave', monthlyAllowance: 2, carryForward: true, latePenaltyCount: 3 },
            { organizationId: orgId, leaveType: 'Sick Leave', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3 },
            { organizationId: orgId, leaveType: 'WFH', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3 },
            { organizationId: orgId, leaveType: 'Permission', monthlyAllowance: 3, carryForward: false, latePenaltyCount: 3 },
        ];
        await LeavePolicy_js_1.LeavePolicy.insertMany(leavePoliciesData);
        logger_js_1.logger.info('✅ Seeded Organization Leave Policies.');
        // 6. Seed Permanent Enterprise Employee Record
        const empId = new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79001');
        const empData = {
            _id: empId,
            organizationId: orgId,
            employeeCode: 'DEV-001',
            fullName: 'Logapriyan M',
            email: 'logapriyan@ethicsec.com',
            phone: '+91 9876543210',
            department: index_js_1.DEPARTMENTS.DEV,
            designation: 'Full Stack Engineer',
            joiningDate: new Date('2026-01-15'),
            salary: 45000,
            address: 'Chennai, Tamil Nadu',
            emergencyContact: {
                name: 'Ravi M',
                relationship: 'Father',
                phone: '+91 9876543211',
            },
            leaveBalance: 2,
            wfhBalance: 1,
            permissionHoursBalance: 3,
            isActive: true,
        };
        await Employee_js_1.Employee.create(empData);
        logger_js_1.logger.info('✅ Seeded Permanent Enterprise Employee Record (Logapriyan M).');
        // 7. Seed Users (Abishek, Oviya & Logapriyan)
        const usersData = [
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79101'), organizationId: orgId, name: 'Abishek', email: 'Official@ethicsecur.co.in', password: await PasswordService_js_1.PasswordService.hashPassword('Ethicsecur@2024'), role: index_js_1.ROLES.ADMIN, isActive: true },
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79202'), organizationId: orgId, name: 'Oviya', email: 'oviya@ethicsecur.com', password: await PasswordService_js_1.PasswordService.hashPassword('Ovi@2003'), role: index_js_1.ROLES.HR, isActive: true },
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79303'), organizationId: orgId, name: 'Logapriyan M', email: 'logapriyan@ethicsec.com', password: await PasswordService_js_1.PasswordService.hashPassword('EthicSec@2026'), role: index_js_1.ROLES.EMPLOYEE, employeeId: empId, isActive: true },
        ];
        const createdUsers = await User_js_1.User.insertMany(usersData);
        logger_js_1.logger.info(`✅ Seeded ${createdUsers.length} Enterprise Users (Admin, HR & Employee).`);
        await (0, exports.syncRolePermissions)(orgId);
        logger_js_1.logger.info('🚀 Database Seeding Completed Successfully! Enterprise HRMS is ready with clean state.');
    }
    catch (error) {
        logger_js_1.logger.error('❌ Database Seeding Failed:', { error });
    }
};
exports.seedDatabase = seedDatabase;
const syncRolePermissions = async (orgId) => {
    const { PermissionSyncService } = await import('../domains/organization/services/PermissionSyncService.js');
    await PermissionSyncService.syncForTenant(orgId);
};
exports.syncRolePermissions = syncRolePermissions;
