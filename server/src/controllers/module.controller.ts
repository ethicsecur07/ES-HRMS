import { Response } from 'express';
import { Module } from '../models/Module.js';
import { ModuleRoute } from '../models/ModuleRoute.js';
import { OrganizationModule } from '../models/OrganizationModule.js';
import { Permission } from '../models/Permission.js';
import { AuthRequest } from '../types/index.js';
import mongoose from 'mongoose';

// Hardcoded fallback data in case database is empty or seeding is needed
const DEFAULT_MODULE_CODES = [
  'DASHBOARD',
  'EMPLOYEES',
  'ATTENDANCE',
  'LEAVES',
  'LEAVE_POLICY',
  'TASKS',
  'PAYROLL',
  'FINANCE',
  'WORKFLOW',
  'ADVANCED_ATTENDANCE',
  'REPORTS',
  'AUDIT_LOGS',
  'SETTINGS',
  'SELF_SERVICE',
  'DOCUMENTS',
  'PROJECTS',
  'RECRUITMENT',
  'CHAT',
  'NOTIFICATIONS',
  'MEETINGS',
];

const DEFAULT_MODULES = [
  { name: 'Dashboard', code: 'DASHBOARD', version: '1.0.0', isActive: true },
  { name: 'Employees Registry', code: 'EMPLOYEES', version: '1.0.0', isActive: true },
  { name: 'Attendance & Tracking', code: 'ATTENDANCE', version: '1.0.0', isActive: true },
  { name: 'Leave & WFH Management', code: 'LEAVES', version: '1.0.0', isActive: true },
  { name: 'Leave Policy Configuration', code: 'LEAVE_POLICY', version: '1.0.0', isActive: true },
  { name: 'Task & Daily Reports', code: 'TASKS', version: '1.0.0', isActive: true },
  { name: 'Payroll & Compensation', code: 'PAYROLL', version: '1.0.0', isActive: true },
  { name: 'Finance & ERP Accounts', code: 'FINANCE', version: '1.0.0', isActive: true },
  { name: 'Workflow Approval Engine', code: 'WORKFLOW', version: '1.0.0', isActive: true },
  { name: 'Advanced Attendance Engine', code: 'ADVANCED_ATTENDANCE', version: '1.0.0', isActive: true },
  { name: 'Reports & Analytics', code: 'REPORTS', version: '1.0.0', isActive: true },
  { name: 'Audit Logging & Compliance', code: 'AUDIT_LOGS', version: '1.0.0', isActive: true },
  { name: 'System Settings', code: 'SETTINGS', version: '1.0.0', isActive: true },
  { name: 'Self Service Center', code: 'SELF_SERVICE', version: '1.0.0', isActive: true },
  { name: 'Document Management', code: 'DOCUMENTS', version: '1.0.0', isActive: true },
  { name: 'Projects & Tasks', code: 'PROJECTS', version: '1.0.0', isActive: true },
  { name: 'ATS Recruitment', code: 'RECRUITMENT', version: '1.0.0', isActive: true },
  { name: 'Internal Chat', code: 'CHAT', version: '1.0.0', isActive: true },
  { name: 'System Notifications', code: 'NOTIFICATIONS', version: '1.0.0', isActive: true },
  { name: 'Teams Meetings Center', code: 'MEETINGS', version: '1.0.0', isActive: true },
];


const DEFAULT_ROUTES = [
  { moduleCode: 'DASHBOARD', routePath: '/dashboard', displayName: 'Dashboard', order: 1 },
  { moduleCode: 'EMPLOYEES', routePath: '/employees', displayName: 'Employees', order: 2 },
  { moduleCode: 'ATTENDANCE', routePath: '/attendance', displayName: 'Attendance History', order: 3 },
  { moduleCode: 'LEAVES', routePath: '/leave-wfh', displayName: 'Leave / WFH / Perms', order: 4 },
  { moduleCode: 'TASKS', routePath: '/task-reports', displayName: 'Task & Daily Reports', order: 5 },
  { moduleCode: 'PAYROLL', routePath: '/payroll', displayName: 'Payroll', order: 6 },
  { moduleCode: 'FINANCE', routePath: '/finance', displayName: 'Finance & Maintenance', order: 7 },
  { moduleCode: 'REPORTS', routePath: '/reports', displayName: 'Reports & Analytics', order: 10 },
  { moduleCode: 'AUDIT_LOGS', routePath: '/audit-logs', displayName: 'Audit Logs', order: 11 },
  { moduleCode: 'SETTINGS', routePath: '/settings', displayName: 'Settings', order: 12 },
  { moduleCode: 'SELF_SERVICE', routePath: '/self-service', displayName: 'Self Service', order: 13 },
  { moduleCode: 'DOCUMENTS', routePath: '/documents', displayName: 'Documents', order: 14 },
  { moduleCode: 'PROJECTS', routePath: '/projects', displayName: 'Projects', order: 15 },
  { moduleCode: 'RECRUITMENT', routePath: '/recruitment', displayName: 'Recruitment', order: 16 },
  { moduleCode: 'CHAT', routePath: '/chat', displayName: 'Chat', order: 17 },
  { moduleCode: 'NOTIFICATIONS', routePath: '/notifications', displayName: 'Notifications', order: 18 },
  { moduleCode: 'MEETINGS', routePath: '/meetings', displayName: 'Meetings', order: 19 },
];

// Helper to ensure core Modules and ModuleRoutes exist in database
const ensureCoreModulesAndRoutes = async () => {
  // Clean up any obsolete/removed core modules, routes, and permissions from database
  await Module.deleteMany({ code: { $in: ['EMPLOYEE_LIFECYCLE', 'ORG_STRUCTURE'] } });
  await ModuleRoute.deleteMany({ moduleCode: { $in: ['EMPLOYEE_LIFECYCLE', 'ORG_STRUCTURE'] } });
  await OrganizationModule.deleteMany({ moduleCode: { $in: ['EMPLOYEE_LIFECYCLE', 'ORG_STRUCTURE'] } });
  await Permission.deleteMany({ module: { $in: ['EMPLOYEE_LIFECYCLE', 'ORG_STRUCTURE'] } });

  for (const m of DEFAULT_MODULES) {
    await Module.updateOne({ code: m.code }, { $set: m }, { upsert: true });
  }

  for (const r of DEFAULT_ROUTES) {
    await ModuleRoute.updateOne({ moduleCode: r.moduleCode, routePath: r.routePath }, { $set: r }, { upsert: true });
  }
};

const ensureOrgModules = async (orgId: mongoose.Types.ObjectId) => {
  for (const code of DEFAULT_MODULE_CODES) {
    const exists = await OrganizationModule.findOne({ organizationId: orgId, moduleCode: code });
    if (!exists) {
      await OrganizationModule.create({
        organizationId: orgId,
        moduleCode: code,
        isEnabled: true,
        featureFlags: new Map(),
      });
    }
  }
};

export const getEnabledModules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgIdStr = req.user?.organizationId || '605c72ef1f77bcf86cd79000';
    const orgId = new mongoose.Types.ObjectId(orgIdStr);

    await ensureCoreModulesAndRoutes();
    await ensureOrgModules(orgId);

    // Query organization enabled modules
    const orgModules = await OrganizationModule.find({ organizationId: orgId, isEnabled: true });
    const enabledCodes = orgModules.map((m) => m.moduleCode);
    res.status(200).json(enabledCodes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getModuleRoutes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgIdStr = req.user?.organizationId || '605c72ef1f77bcf86cd79000';
    const orgId = new mongoose.Types.ObjectId(orgIdStr);

    await ensureCoreModulesAndRoutes();
    await ensureOrgModules(orgId);

    // First get enabled modules for the org
    const orgModules = await OrganizationModule.find({ organizationId: orgId, isEnabled: true });
    const enabledCodes = new Set(orgModules.map((m) => m.moduleCode));

    // Fetch all routes from DB
    const dbRoutes = await ModuleRoute.find({}).sort({ order: 1 });
    
    // Filter to only return routes of modules that are enabled
    const filteredRoutes = dbRoutes
      .filter((r) => enabledCodes.has(r.moduleCode))
      .map((r) => ({
        moduleCode: r.moduleCode,
        routePath: r.routePath,
        displayName: r.displayName,
        order: r.order,
      }));

    res.status(200).json(filteredRoutes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
