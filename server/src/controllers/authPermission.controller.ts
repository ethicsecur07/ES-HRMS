import { Response } from 'express';
import { Permission } from '../models/Permission.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { AuthRequest } from '../types/index.js';
import { redisClearPattern } from '../utils/redisClient.js';

const DEFAULT_MODULES = [
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
];


/**
 * Get permission matrix: lists all modules and how they are configured for each role.
 */
export const getPermissionMatrix = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const roles = await Role.find({ organizationId: orgId }).select('_id name code parentRoleId isActive');
    const permissions = await Permission.find({
      organizationId: orgId,
      roleId: { $ne: null },
      userId: null,
    });

    res.status(200).json({
      success: true,
      data: {
        modules: DEFAULT_MODULES,
        roles,
        permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve permission matrix.', error: error.message });
  }
};

/**
 * Update the permission matrix: bulk upsert role permissions.
 */
export const updatePermissionMatrix = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const { updates } = req.body;
    if (!updates || !Array.isArray(updates)) {
      res.status(400).json({ success: false, message: 'Invalid payload. updates array is required.' });
      return;
    }

    const bulkOps = [];
    for (const update of updates) {
      const { roleId, module, actions, restrictedFields, policyCondition } = update;
      if (!roleId || !module || !actions) {
        res.status(400).json({ success: false, message: 'roleId, module, and actions are required for each update.' });
        return;
      }

      bulkOps.push({
        updateOne: {
          filter: {
            organizationId: orgId,
            roleId,
            module,
            userId: null,
          },
          update: {
            $set: {
              actions: {
                view: !!actions.view,
                create: !!actions.create,
                edit: !!actions.edit,
                delete: !!actions.delete,
                approve: !!actions.approve,
                assign: !!actions.assign,
                export: !!actions.export,
              },
              restrictedFields: restrictedFields || [],
              policyCondition: policyCondition !== undefined ? policyCondition : null,
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await Permission.bulkWrite(bulkOps);
    }

    // Invalidate Redis RBAC cache for this organization
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(200).json({ success: true, message: 'Permission matrix updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update permission matrix.', error: error.message });
  }
};

/**
 * Get user-specific overrides.
 */
export const getUserOverrides = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { userId } = req.query;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId query parameter is required.' });
      return;
    }

    const overrides = await Permission.find({
      organizationId: orgId,
      userId,
      roleId: null,
    });

    res.status(200).json({ success: true, data: overrides });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve user overrides.', error: error.message });
  }
};

/**
 * Upsert a user-specific permission override.
 */
export const upsertUserOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const { userId, module, actions, restrictedFields, policyCondition } = req.body;

    if (!userId || !module || !actions) {
      res.status(400).json({ success: false, message: 'userId, module, and actions are required.' });
      return;
    }

    // Verify user exists in the organization
    const userExists = await User.findOne({ _id: userId, organizationId: orgId });
    if (!userExists) {
      res.status(404).json({ success: false, message: 'User not found in this organization.' });
      return;
    }

    const override = await Permission.findOneAndUpdate(
      {
        organizationId: orgId,
        userId,
        module,
        roleId: null,
      },
      {
        $set: {
          actions: {
            view: !!actions.view,
            create: !!actions.create,
            edit: !!actions.edit,
            delete: !!actions.delete,
            approve: !!actions.approve,
            assign: !!actions.assign,
            export: !!actions.export,
          },
          restrictedFields: restrictedFields || [],
          policyCondition: policyCondition !== undefined ? policyCondition : null,
        },
      },
      { upsert: true, new: true }
    );

    // Invalidate Redis RBAC cache for this user specifically
    await redisClearPattern(`rbac:${orgId}:${userId}:*`);

    res.status(200).json({ success: true, message: 'User permission override configured successfully.', data: override });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to configure user override.', error: error.message });
  }
};

/**
 * Delete a user-specific permission override.
 */
export const deleteUserOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { userId, module } = req.body;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    if (!userId || !module) {
      res.status(400).json({ success: false, message: 'userId and module are required.' });
      return;
    }

    const result = await Permission.deleteOne({
      organizationId: orgId,
      userId,
      module,
      roleId: null,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, message: 'No override found to delete.' });
      return;
    }

    // Invalidate Redis RBAC cache for this user
    await redisClearPattern(`rbac:${orgId}:${userId}:*`);

    res.status(200).json({ success: true, message: 'User permission override removed successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete user override.', error: error.message });
  }
};

/**
 * Get compiled permissions for the currently logged-in user.
 */
export const getMyPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const orgId = user.organizationId;
    const userId = user.id;

    // Find the user's base role
    const userRole = await Role.findOne({
      organizationId: orgId,
      code: user.role,
      isActive: true,
    });

    const roleIds: string[] = [];
    if (userRole) {
      roleIds.push(userRole._id.toString());
    }

    // 1. Fetch custom roles assigned in RoleMember collection
    const { RoleMember } = await import('../models/RoleMember.js');
    const customRoleMembers = await RoleMember.find({
      organizationId: orgId,
      userId: userId,
    });

    for (const rm of customRoleMembers) {
      if (rm.roleId && !roleIds.includes(rm.roleId.toString())) {
        roleIds.push(rm.roleId.toString());
      }
    }

    // 2. Recursively compile parent roles for all assigned roles
    const compiledRoleIds = [...roleIds];
    const maxDepth = 10;

    for (const rId of roleIds) {
      let currentParentId: any = null;
      const roleObj = await Role.findOne({ _id: rId, organizationId: orgId, isActive: true });
      if (roleObj) currentParentId = roleObj.parentRoleId;

      let depth = 0;
      while (currentParentId && depth < maxDepth) {
        const parentRole = await Role.findOne({
          _id: currentParentId,
          organizationId: orgId,
          isActive: true,
        });
        if (!parentRole) break;
        const parentIdStr = parentRole._id.toString();
        if (!compiledRoleIds.includes(parentIdStr)) {
          compiledRoleIds.push(parentIdStr);
        }
        currentParentId = parentRole.parentRoleId;
        depth++;
      }
    }

    // Find all permissions (role and user overrides)
    const permissions = await Permission.find({
      organizationId: orgId,
      $or: [
        { userId: userId },
        { roleId: { $in: compiledRoleIds } },
      ],
    });

    // Group permissions by module
    const modulesMap: Record<string, { actions: any; restrictedFields: string[]; policyCondition: any }> = {};

    // Get unique modules
    const uniqueModules = Array.from(new Set(permissions.map((p) => p.module)));

    for (const mod of uniqueModules) {
      const modPerms = permissions.filter((p) => p.module === mod);
      
      const directPermissions = modPerms.filter((p) => p.userId?.toString() === userId.toString());
      const rolePermissions = modPerms.filter((p) => !p.userId && compiledRoleIds.includes(p.roleId?.toString() || ''));
      
      const activePermsForMod = directPermissions.length > 0 ? directPermissions : rolePermissions;

      // Compile action boolean flags
      const actions = {
        view: activePermsForMod.some((p) => p.actions?.view === true),
        create: activePermsForMod.some((p) => p.actions?.create === true),
        edit: activePermsForMod.some((p) => p.actions?.edit === true),
        delete: activePermsForMod.some((p) => p.actions?.delete === true),
        approve: activePermsForMod.some((p) => p.actions?.approve === true),
        assign: activePermsForMod.some((p) => p.actions?.assign === true),
        export: activePermsForMod.some((p) => p.actions?.export === true),
      };

      // Compile restricted fields
      const hasUnrestrictedFields = activePermsForMod.some((p) => !p.restrictedFields || p.restrictedFields.length === 0);
      let restrictedFields: string[] = [];
      if (!hasUnrestrictedFields) {
        const restrictedFieldsSet = new Set<string>();
        activePermsForMod.forEach((p) => {
          if (p.restrictedFields && Array.isArray(p.restrictedFields)) {
            p.restrictedFields.forEach((field: string) => restrictedFieldsSet.add(field));
          }
        });
        restrictedFields = Array.from(restrictedFieldsSet);
      }

      // Compile policies
      const policies = activePermsForMod
        .map((p) => p.policyCondition)
        .filter((cond) => !!cond && typeof cond === 'object');

      modulesMap[mod] = {
        actions,
        restrictedFields,
        policyCondition: policies.length > 0 ? policies : null,
      };
    }

    res.status(200).json({ success: true, data: modulesMap });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to resolve my permissions.', error: error.message });
  }
};

/**
 * Force re-sync of all role permissions for the current organization.
 * This is useful when new modules are added or permissions need to be reset.
 * ADMIN only.
 */
export const syncPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Only ADMIN can trigger a permission sync.' });
      return;
    }

    const mongoose = await import('mongoose');
    const { PermissionSyncService } = await import('../domains/organization/services/PermissionSyncService.js');
    await PermissionSyncService.syncForTenant(new mongoose.default.Types.ObjectId(orgId), undefined, true);

    // Clear Redis RBAC cache for this organization
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(200).json({ success: true, message: 'Role permissions successfully synchronized for all modules including PROJECTS and RECRUITMENT.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to sync permissions.', error: error.message });
  }
};
