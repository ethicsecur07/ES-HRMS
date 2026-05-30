"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionSyncService = void 0;
const Role_js_1 = require("../../../models/Role.js");
const Permission_js_1 = require("../../../models/Permission.js");
const logger_js_1 = require("../../../utils/logger.js");
class PermissionSyncService {
    /**
     * Synchronizes standard RBAC permissions for the core roles of a specific tenant.
     * This is required when onboarding a new SaaS tenant so they don't start with 0 permissions.
     */
    static async syncForTenant(orgId, session, force = false) {
        try {
            logger_js_1.logger.info(`🔑 Synchronizing role permissions for organization: ${orgId} (force reset: ${force})`);
            let roles = await Role_js_1.Role.find({ organizationId: orgId }).session(session || null);
            const rolesMissingSlug = roles.filter((role) => !role.slug);
            if (rolesMissingSlug.length > 0) {
                await Role_js_1.Role.bulkWrite(rolesMissingSlug.map((role) => ({
                    updateOne: {
                        filter: { _id: role._id },
                        update: { $set: { slug: role.code.toLowerCase() } },
                    },
                })), { session });
                roles = await Role_js_1.Role.find({ organizationId: orgId }).session(session || null);
            }
            let adminRole = roles.find((r) => r.code === 'ADMIN');
            let managerRole = roles.find((r) => r.code === 'MANAGER');
            let hrRole = roles.find((r) => r.code === 'HR');
            let teamLeadRole = roles.find((r) => r.code === 'TEAM_LEAD');
            let employeeRole = roles.find((r) => r.code === 'EMPLOYEE');
            // Ensure all 5 roles exist
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
            })), { session });
            const createdRoles = await Role_js_1.Role.find({ organizationId: orgId }).session(session || null);
            adminRole = createdRoles.find((r) => r.code === 'ADMIN');
            managerRole = createdRoles.find((r) => r.code === 'MANAGER');
            hrRole = createdRoles.find((r) => r.code === 'HR');
            teamLeadRole = createdRoles.find((r) => r.code === 'TEAM_LEAD');
            employeeRole = createdRoles.find((r) => r.code === 'EMPLOYEE');
            if (!adminRole || !managerRole || !hrRole || !teamLeadRole || !employeeRole) {
                throw new Error("Critical Failure: Core roles could not be provisioned.");
            }
            // Update hierarchy links (parentRoleId)
            await Role_js_1.Role.bulkWrite([
                {
                    updateOne: {
                        filter: { _id: adminRole._id },
                        update: { $set: { parentRoleId: managerRole._id } }
                    }
                },
                {
                    updateOne: {
                        filter: { _id: managerRole._id },
                        update: { $set: { parentRoleId: hrRole._id } }
                    }
                },
                {
                    updateOne: {
                        filter: { _id: hrRole._id },
                        update: { $set: { parentRoleId: teamLeadRole._id } }
                    }
                },
                {
                    updateOne: {
                        filter: { _id: teamLeadRole._id },
                        update: { $set: { parentRoleId: employeeRole._id } }
                    }
                },
                {
                    updateOne: {
                        filter: { _id: employeeRole._id },
                        update: { $set: { parentRoleId: null } }
                    }
                }
            ], { session });
            const allModules = [
                'DASHBOARD',
                'EMPLOYEES',
                'ATTENDANCE',
                'LEAVES',
                'LEAVE_POLICY',
                'TASKS',
                'PAYROLL',
                'FINANCE',
                'ORG_STRUCTURE',
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
            const employeeSelfServiceModules = [
                'DASHBOARD',
                'ATTENDANCE',
                'ADVANCED_ATTENDANCE',
                'LEAVES',
                'TASKS',
                'WORKFLOW',
                'SELF_SERVICE',
                'DOCUMENTS',
                'CHAT',
                'NOTIFICATIONS',
                'MEETINGS',
            ];
            // Modules accessible to TEAM_LEAD (view-only for project tracking)
            const teamLeadViewModules = ['PROJECTS', 'RECRUITMENT', 'MEETINGS'];
            // Prepare upsert operations
            const operations = [];
            // 1. ADMIN permissions (Full access)
            for (const moduleCode of allModules) {
                operations.push({
                    updateOne: {
                        filter: { organizationId: orgId, roleId: adminRole._id, userId: null, module: moduleCode },
                        update: force ? {
                            $set: {
                                actions: { view: true, create: true, edit: true, delete: true, approve: true, assign: true, export: true },
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        } : {
                            $setOnInsert: {
                                actions: { view: true, create: true, edit: true, delete: true, approve: true, assign: true, export: true },
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        },
                        upsert: true,
                    }
                });
            }
            // 2. MANAGER permissions (Full access except settings/audit logs)
            for (const moduleCode of allModules) {
                const isExcluded = ['AUDIT_LOGS', 'SETTINGS'].includes(moduleCode);
                const actions = {
                    view: !isExcluded,
                    create: !isExcluded,
                    edit: !isExcluded,
                    delete: !isExcluded,
                    approve: !isExcluded,
                    assign: !isExcluded,
                    export: !isExcluded,
                };
                operations.push({
                    updateOne: {
                        filter: { organizationId: orgId, roleId: managerRole._id, userId: null, module: moduleCode },
                        update: force ? {
                            $set: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        } : {
                            $setOnInsert: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        },
                        upsert: true,
                    }
                });
            }
            // 3. HR permissions (Same as Manager)
            for (const moduleCode of allModules) {
                const isExcluded = ['AUDIT_LOGS', 'SETTINGS'].includes(moduleCode);
                const actions = {
                    view: !isExcluded,
                    create: !isExcluded,
                    edit: !isExcluded,
                    delete: !isExcluded,
                    approve: !isExcluded,
                    assign: !isExcluded,
                    export: !isExcluded,
                };
                operations.push({
                    updateOne: {
                        filter: { organizationId: orgId, roleId: hrRole._id, userId: null, module: moduleCode },
                        update: force ? {
                            $set: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        } : {
                            $setOnInsert: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        },
                        upsert: true,
                    }
                });
            }
            // 4. TEAM_LEAD permissions (Inherits EMPLOYEE, but gets explicit approval permissions on self service)
            for (const moduleCode of allModules) {
                const isSelfService = employeeSelfServiceModules.includes(moduleCode);
                const isTeamLeadView = teamLeadViewModules.includes(moduleCode);
                const actions = {
                    view: isSelfService || moduleCode === 'EMPLOYEES' || isTeamLeadView,
                    create: isSelfService || isTeamLeadView,
                    edit: isSelfService || isTeamLeadView,
                    delete: false,
                    approve: isSelfService,
                    assign: isSelfService || isTeamLeadView,
                    export: false,
                };
                operations.push({
                    updateOne: {
                        filter: { organizationId: orgId, roleId: teamLeadRole._id, userId: null, module: moduleCode },
                        update: force ? {
                            $set: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        } : {
                            $setOnInsert: {
                                actions,
                                restrictedFields: [],
                                policyCondition: null,
                            },
                        },
                        upsert: true,
                    }
                });
            }
            // 5. EMPLOYEE permissions
            for (const moduleCode of allModules) {
                const isSelfService = employeeSelfServiceModules.includes(moduleCode);
                if (moduleCode === 'EMPLOYEES') {
                    const actions = {
                        view: true,
                        create: false,
                        edit: false,
                        delete: false,
                        approve: false,
                        assign: false,
                        export: false,
                    };
                    operations.push({
                        updateOne: {
                            filter: { organizationId: orgId, roleId: employeeRole._id, userId: null, module: moduleCode },
                            update: force ? {
                                $set: {
                                    actions,
                                    restrictedFields: ['salary', 'address', 'emergencyContact'],
                                    policyCondition: null,
                                },
                            } : {
                                $setOnInsert: {
                                    actions,
                                    restrictedFields: ['salary', 'address', 'emergencyContact'],
                                    policyCondition: null,
                                },
                            },
                            upsert: true,
                        }
                    });
                    continue;
                }
                // Dynamic JSON ABAC Policy for Employees (can only view/edit/create their OWN records)
                const selfServicePolicy = isSelfService ? [
                    [{ attribute: "resource.employeeId", operator: "EQUALS", value: "user.employeeId" }]
                ] : null;
                const actions = {
                    view: isSelfService,
                    create: isSelfService,
                    edit: isSelfService,
                    delete: false,
                    approve: false,
                    assign: false,
                    export: false,
                };
                operations.push({
                    updateOne: {
                        filter: { organizationId: orgId, roleId: employeeRole._id, userId: null, module: moduleCode },
                        update: force ? {
                            $set: {
                                actions,
                                restrictedFields: [],
                                policyCondition: selfServicePolicy,
                            },
                        } : {
                            $setOnInsert: {
                                actions,
                                restrictedFields: [],
                                policyCondition: selfServicePolicy,
                            },
                        },
                        upsert: true,
                    }
                });
            }
            await Permission_js_1.Permission.bulkWrite(operations, { session });
            logger_js_1.logger.info(`✅ Role permissions successfully synchronized for org ${orgId}.`);
        }
        catch (error) {
            logger_js_1.logger.error('❌ Failed to synchronize role permissions:', { error });
            throw error;
        }
    }
}
exports.PermissionSyncService = PermissionSyncService;
