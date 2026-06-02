import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { Attendance } from '../models/Attendance.js';
import { Leave } from '../models/Leave.js';
import { Payroll } from '../models/Payroll.js';
import { PermissionRequest } from '../models/PermissionRequest.js';
import { TaskReport } from '../models/TaskReport.js';
import { Finance } from '../models/Finance.js';
import { AuditLog } from '../models/AuditLog.js';
import { Organization } from '../models/Organization.js';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { Designation } from '../models/Designation.js';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { OfferTemplate } from '../models/OfferTemplate.js';
import { logger } from '../utils/logger.js';
import { ROLES } from '../constants/index.js';
import { PasswordService } from '../domains/auth-engine/services/PasswordService.js';

export const seedDatabase = async (): Promise<void> => {
  try {
    // Programmatically drop legacy single-field unique index on leavepolicies if it exists
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('leavepolicies').dropIndex('organizationId_1_leaveType_1');
        logger.info('Dropped legacy unique index organizationId_1_leaveType_1 from leavepolicies collection.');
      }
    } catch (_) {
      // Index might not exist, ignore
    }

    const orgId = new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79000');
    const adminExists = await User.findOne({ email: /official@ethicsecur\.co\.in/i, organizationId: orgId });

    if (adminExists) {
      logger.info('Database already seeded. Checking/migrating passwords and cleaning legacy seed data...');
      const usersToVerify = [
        { email: 'official@ethicsecur.co.in', defaultPass: 'Ethicsecur@2024' },
        { email: 'oviya@ethicsecur.com', defaultPass: 'Ovi@2003' },
      ];
      for (const u of usersToVerify) {
        const userRecord = await User.findOne({ email: u.email, organizationId: orgId }).select('+password');
        if (userRecord && userRecord.password && !userRecord.password.startsWith('$argon2') && !userRecord.password.startsWith('$2')) {
          logger.info(`Fixing plain-text password for seeded user: ${u.email}`);
          userRecord.password = await PasswordService.hashPassword(u.defaultPass);
          await userRecord.save();
        }
      }

      // --- One-time cleanup: Remove legacy seeded Logapriyan employee (replaced by Microsoft Sync) ---
      const legacyEmp = await Employee.findOne({ email: 'logapriyan@ethicsec.com', organizationId: orgId });
      if (legacyEmp) {
        await User.deleteMany({ employeeId: legacyEmp._id, organizationId: orgId });
        await Employee.deleteOne({ _id: legacyEmp._id });
        logger.info('🗑️ Removed legacy seeded employee (Logapriyan M / DEV-001). Employee list is now managed via Microsoft Sync.');
      }
      // Also remove the legacy logapriyan user account if orphaned
      await User.deleteMany({ email: 'logapriyan@ethicsec.com', organizationId: orgId });

      // Ensure Manager and Team Lead exist
      const managerExists = await User.findOne({ email: 'siddharth@ethicsecur.com' });
      if (!managerExists) {
        await User.create({ _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79404'), organizationId: orgId, name: 'Siddharth', email: 'siddharth@ethicsecur.com', password: await PasswordService.hashPassword('EthicSec@2026'), role: ROLES.MANAGER, isActive: true });
        logger.info('Seeded missing Manager user.');
      }
      const teamLeadExists = await User.findOne({ email: 'karthik@ethicsecur.com' });
      if (!teamLeadExists) {
        await User.create({ _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79505'), organizationId: orgId, name: 'Karthik', email: 'karthik@ethicsecur.com', password: await PasswordService.hashPassword('EthicSec@2026'), role: ROLES.TEAM_LEAD, isActive: true });
        logger.info('Seeded missing Team Lead user.');
      }

      // Ensure default leave policies exist for both EMPLOYEE and INTERN groups
      const policyCount = await LeavePolicy.countDocuments({ organizationId: orgId });
      if (policyCount < 8 || !await LeavePolicy.findOne({ organizationId: orgId, applicableTo: 'INTERN' })) {
        logger.info('Leave policies missing or incomplete in already-seeded database. Seeding...');
        const leavePoliciesData = [
          { organizationId: orgId, leaveType: 'Casual Leave', monthlyAllowance: 2, carryForward: true, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
          { organizationId: orgId, leaveType: 'Sick Leave', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
          { organizationId: orgId, leaveType: 'WFH', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
          { organizationId: orgId, leaveType: 'Permission', monthlyAllowance: 3, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
          
          { organizationId: orgId, leaveType: 'Casual Leave', monthlyAllowance: 0, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
          { organizationId: orgId, leaveType: 'Sick Leave', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
          { organizationId: orgId, leaveType: 'WFH', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
          { organizationId: orgId, leaveType: 'Permission', monthlyAllowance: 2, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
        ];
        await LeavePolicy.deleteMany({ organizationId: orgId });
        await LeavePolicy.insertMany(leavePoliciesData);
        logger.info('✅ Successfully seeded/re-seeded default leave policies.');
      }

      await seedOfferTemplate(orgId);
      await syncRolePermissions(orgId);
      return;
    }

    logger.info('🌱 Initializing Database Auto-Seeder: Cleaning all collections and seeding multi-tenant structure...');

    // 1. Clean all collections
    await Promise.all([
      Organization.deleteMany({}),
      OrganizationAuthConfig.deleteMany({}),
      Role.deleteMany({}),
      Permission.deleteMany({}),
      Designation.deleteMany({}),
      LeavePolicy.deleteMany({}),
      User.deleteMany({}),
      Employee.deleteMany({}),
      Department.deleteMany({}),
      Attendance.deleteMany({}),
      Leave.deleteMany({}),
      Payroll.deleteMany({}),
      PermissionRequest.deleteMany({}),
      TaskReport.deleteMany({}),
      Finance.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    logger.info('🗑️ Successfully deleted legacy data across all collections.');

    // 2. Seed Default Organization
    const defaultOrg = await Organization.create({
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
    logger.info('✅ Seeded Default Organization (EthicSecur Global).');

    // 3. Seed Default Auth Config for local auth
    await OrganizationAuthConfig.create({
      organizationId: orgId,
      provider: 'LOCAL',
      isEnabled: true,
    });
    logger.info('✅ Seeded Local Authentication Provider Config.');

    // 4. Seed Core Roles
    const rolesData = [
      { organizationId: orgId, name: 'System Administrator', code: 'ADMIN', slug: 'admin', description: 'Complete system dashboard management' },
      { organizationId: orgId, name: 'Operations Manager', code: 'MANAGER', slug: 'manager', description: 'Operations & Department Manager' },
      { organizationId: orgId, name: 'HR Manager', code: 'HR', slug: 'hr', description: 'Human Resource onboarding & payroll manager' },
      { organizationId: orgId, name: 'Team Lead', code: 'TEAM_LEAD', slug: 'team-lead', description: 'Team Lead for project operations' },
      { organizationId: orgId, name: 'General Employee', code: 'EMPLOYEE', slug: 'employee', description: 'Core work logs & self service' },
    ];
    await Role.bulkWrite(
      rolesData.map((role) => ({
        updateOne: {
          filter: { organizationId: orgId, code: role.code },
          update: { $set: role },
          upsert: true,
        },
      }))
    );
    logger.info('✅ Seeded Core Roles (ADMIN, MANAGER, HR, TEAM_LEAD, EMPLOYEE).');

    // 5. Seed Leave Policies
    const leavePoliciesData = [
      { organizationId: orgId, leaveType: 'Casual Leave', monthlyAllowance: 2, carryForward: true, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
      { organizationId: orgId, leaveType: 'Sick Leave', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
      { organizationId: orgId, leaveType: 'WFH', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
      { organizationId: orgId, leaveType: 'Permission', monthlyAllowance: 3, carryForward: false, latePenaltyCount: 3, applicableTo: 'EMPLOYEE' },
      
      { organizationId: orgId, leaveType: 'Casual Leave', monthlyAllowance: 0, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
      { organizationId: orgId, leaveType: 'Sick Leave', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
      { organizationId: orgId, leaveType: 'WFH', monthlyAllowance: 1, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
      { organizationId: orgId, leaveType: 'Permission', monthlyAllowance: 2, carryForward: false, latePenaltyCount: 3, applicableTo: 'INTERN' },
    ];
    await LeavePolicy.insertMany(leavePoliciesData);
    logger.info('✅ Seeded Organization Employee & Intern Leave Policies.');

    // Note: Employee records are populated exclusively via Microsoft Directory Sync.
    // No static employee seed data is inserted — use the 'Sync Microsoft' button in the Employee Directory.

    // 7. Seed System Users (Admin & HR only — employees come from Microsoft Sync)
    const usersData = [
      { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79101'), organizationId: orgId, name: 'Abishek', email: 'Official@ethicsecur.co.in', password: await PasswordService.hashPassword('Ethicsecur@2024'), role: ROLES.ADMIN, isActive: true },
      { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79202'), organizationId: orgId, name: 'Oviya', email: 'oviya@ethicsecur.com', password: await PasswordService.hashPassword('Ovi@2003'), role: ROLES.HR, isActive: true },
    ];

    const createdUsers = await User.insertMany(usersData);
    logger.info(`✅ Seeded ${createdUsers.length} System Users (Admin & HR). Employees will be synced from Microsoft Directory.`);

    await seedOfferTemplate(orgId);
    await syncRolePermissions(orgId);

    logger.info('🚀 Database Seeding Completed Successfully! Enterprise HRMS is ready with clean state.');
  } catch (error) {
    logger.error('❌ Database Seeding Failed:', { error });
  }
};

const seedOfferTemplate = async (orgId: mongoose.Types.ObjectId): Promise<void> => {
  try {
    const templateExists = await OfferTemplate.findOne({ organizationId: orgId });
    if (!templateExists) {
      await OfferTemplate.create({
        name: 'Default Offer Template',
        subject: 'Job Offer: {{appliedRole}} - ES EthicSecur SofTec Pvt Ltd',
        bodyText: `Dear {{candidateName}},

We are pleased to offer you the position of {{appliedRole}} at ES EthicSecur SofTec for a period of {{duration}}, starting from {{startDate}}. This is a {{stipendDetails}} designed to provide practical exposure to real-time web application development and industry-level projects.

During the internship, you will work with technologies including {{technologies}}, along with frontend and backend development tasks, debugging, testing, and project support under the guidance of our technical team. You are expected to maintain professionalism, confidentiality, and follow company policies throughout the internship period..

We look forward to welcoming you to our team and are confident that your skills and dedication will make a valuable contribution to ES EthicSecur SofTec Pvt Ltd. Please confirm your acceptance of this offer by signing and returning a copy of this letter.`,
        footerPhone: '755028487',
        footerEmail: 'info@ethicsecur.com',
        footerWebsite: 'www.ethicsecur.com',
        footerAddress: '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004',
        signatoryName: 'ES EthicSecur SofTec Private Limited',
        signatoryTitle: 'HR Department',
        organizationId: orgId
      });
      logger.info('✅ Seeded default Offer Letter Template in database.');
    }
  } catch (error) {
    logger.error('Failed to seed offer template:', error);
  }
};


export const syncRolePermissions = async (orgId: mongoose.Types.ObjectId): Promise<void> => {
  const { PermissionSyncService } = await import('../domains/organization/services/PermissionSyncService.js');
  await PermissionSyncService.syncForTenant(orgId);
};
