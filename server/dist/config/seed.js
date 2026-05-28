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
        if (adminExists) {
            logger_js_1.logger.info('Database already seeded. Checking/migrating passwords and cleaning legacy seed data...');
            const usersToVerify = [
                { email: 'official@ethicsecur.co.in', defaultPass: 'Ethicsecur@2024' },
                { email: 'oviya@ethicsecur.com', defaultPass: 'Ovi@2003' },
            ];
            for (const u of usersToVerify) {
                const userRecord = await User_js_1.User.findOne({ email: u.email, organizationId: orgId }).select('+password');
                if (userRecord && userRecord.password && !userRecord.password.startsWith('$argon2') && !userRecord.password.startsWith('$2')) {
                    logger_js_1.logger.info(`Fixing plain-text password for seeded user: ${u.email}`);
                    userRecord.password = await PasswordService_js_1.PasswordService.hashPassword(u.defaultPass);
                    await userRecord.save();
                }
            }
            // --- One-time cleanup: Remove legacy seeded Logapriyan employee (replaced by Microsoft Sync) ---
            const legacyEmp = await Employee_js_1.Employee.findOne({ email: 'logapriyan@ethicsec.com', organizationId: orgId });
            if (legacyEmp) {
                await User_js_1.User.deleteMany({ employeeId: legacyEmp._id, organizationId: orgId });
                await Employee_js_1.Employee.deleteOne({ _id: legacyEmp._id });
                logger_js_1.logger.info('🗑️ Removed legacy seeded employee (Logapriyan M / DEV-001). Employee list is now managed via Microsoft Sync.');
            }
            // Also remove the legacy logapriyan user account if orphaned
            await User_js_1.User.deleteMany({ email: 'logapriyan@ethicsec.com', organizationId: orgId });
            // Ensure Manager and Team Lead exist
            const managerExists = await User_js_1.User.findOne({ email: 'siddharth@ethicsecur.com' });
            if (!managerExists) {
                await User_js_1.User.create({ _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79404'), organizationId: orgId, name: 'Siddharth', email: 'siddharth@ethicsecur.com', password: await PasswordService_js_1.PasswordService.hashPassword('EthicSec@2026'), role: index_js_1.ROLES.MANAGER, isActive: true });
                logger_js_1.logger.info('Seeded missing Manager user.');
            }
            const teamLeadExists = await User_js_1.User.findOne({ email: 'karthik@ethicsecur.com' });
            if (!teamLeadExists) {
                await User_js_1.User.create({ _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79505'), organizationId: orgId, name: 'Karthik', email: 'karthik@ethicsecur.com', password: await PasswordService_js_1.PasswordService.hashPassword('EthicSec@2026'), role: index_js_1.ROLES.TEAM_LEAD, isActive: true });
                logger_js_1.logger.info('Seeded missing Team Lead user.');
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
                salaryCycleStartDay: 1,
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
        // Note: Employee records are populated exclusively via Microsoft Directory Sync.
        // No static employee seed data is inserted — use the 'Sync Microsoft' button in the Employee Directory.
        // 7. Seed System Users (Admin & HR only — employees come from Microsoft Sync)
        const usersData = [
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79101'), organizationId: orgId, name: 'Abishek', email: 'Official@ethicsecur.co.in', password: await PasswordService_js_1.PasswordService.hashPassword('Ethicsecur@2024'), role: index_js_1.ROLES.ADMIN, isActive: true },
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79202'), organizationId: orgId, name: 'Oviya', email: 'oviya@ethicsecur.com', password: await PasswordService_js_1.PasswordService.hashPassword('Ovi@2003'), role: index_js_1.ROLES.HR, isActive: true },
        ];
        const createdUsers = await User_js_1.User.insertMany(usersData);
        logger_js_1.logger.info(`✅ Seeded ${createdUsers.length} System Users (Admin & HR). Employees will be synced from Microsoft Directory.`);
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
