import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { TemporaryGrant } from '../models/TemporaryGrant.js';
import { evaluatePolicy } from '../utils/policyEvaluator.js';
import { redisGet, redisSet } from '../utils/redisClient.js';

export interface RBACRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    organizationId: string;
  };
  restrictedFields?: string[];
  checkPolicyCondition?: (resource: any) => boolean;
}

/**
 * rbacGuard middleware generator.
 * @param moduleCode - The target module code (e.g., 'EMPLOYEES', 'PAYROLL', 'ORG_STRUCTURE').
 * @param action - The requested action (e.g., 'view', 'create', 'edit', 'delete', 'approve', 'assign', 'export').
 */
export const rbacGuard = (
  moduleCode: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'assign' | 'export'
) => {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. User session not found.',
          traceId: req.headers['x-trace-id'] || '',
        });
      }

      const orgId = user.organizationId;
      const userId = user.id;

      // Force block Interns from accessing LEAVES or LEAVE_POLICY
      if (user.role === 'INTERN' && (moduleCode === 'LEAVES' || moduleCode === 'LEAVE_POLICY')) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. Interns do not have access to leaves or leave policies.',
          traceId: req.headers['x-trace-id'] || '',
        });
      }

      // 1. Check for Active Temporary Grant overrides
      const activeGrant = await TemporaryGrant.findOne({
        organizationId: orgId,
        userId: userId,
        module: moduleCode,
        expiresAt: { $gte: new Date() },
        isActive: true,
      });

      if (activeGrant && (activeGrant.actions as any)[action] === true) {
        req.restrictedFields = [];
        req.checkPolicyCondition = () => true; 
        setupSanitizedResponse(req, res);
        return next();
      }

      // 2. REDIS CACHING: Try to fetch compiled permissions from Cache
      const cacheKey = `rbac:${orgId}:${userId}:${user.role}:${moduleCode}`;
      let activePermissions: any[] | null = await redisGet(cacheKey);

      if (!activePermissions) {
        // Cache Miss: Perform Database Lookups
        const roleIds: string[] = [];

        // 1. Fetch custom roles assigned in RoleMember collection
        const { RoleMember } = await import('../models/RoleMember.js');
        const customRoleMembers = await RoleMember.find({
          organizationId: orgId,
          userId: userId,
        });

        for (const rm of customRoleMembers) {
          if (rm.roleId) {
            roleIds.push(rm.roleId.toString());
          }
        }

        // 2. Fetch user's primary system role
        const userRole = await Role.findOne({
          organizationId: orgId,
          code: user.role,
          isActive: true,
        });

        if (userRole && !roleIds.includes(userRole._id.toString())) {
          roleIds.push(userRole._id.toString());
        }

        // 3. No recursive parent compilation (per requirements: permissions restricted to assigned role members only)
        const compiledRoleIds = [...roleIds];

        const permissions = await Permission.find({
          organizationId: orgId,
          module: moduleCode,
          $or: [
            { userId: userId },
            { roleId: { $in: compiledRoleIds } },
          ],
        });

        const directPermissions = permissions.filter((p) => p.userId?.toString() === userId.toString());
        const rolePermissions = permissions.filter((p) => !p.userId && compiledRoleIds.includes(p.roleId?.toString() || ''));
        activePermissions = directPermissions.length > 0 ? directPermissions : rolePermissions;

        // Save to Redis (Cache for 15 minutes)
        await redisSet(cacheKey, activePermissions, 900);
      }

      if (!activePermissions || activePermissions.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Forbidden. No permissions configured for module: ${moduleCode}`,
          traceId: req.headers['x-trace-id'] || '',
        });
      }

      // 4. Verify if action is allowed by at least one active permission
      const grantingPermissions = activePermissions.filter((p) => p.actions && p.actions[action] === true);

      if (grantingPermissions.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Forbidden. Insufficient privileges to perform '${action}' on module: ${moduleCode}`,
          traceId: req.headers['x-trace-id'] || '',
        });
      }

      // If at least one granting permission has NO restricted fields, then there are no restricted fields.
      // Otherwise, union the restricted fields of all granting permissions.
      const hasUnrestrictedFields = grantingPermissions.some((p) => !p.restrictedFields || p.restrictedFields.length === 0);
      if (hasUnrestrictedFields) {
        req.restrictedFields = [];
      } else {
        const restrictedFieldsSet = new Set<string>();
        grantingPermissions.forEach((p) => {
          if (p.restrictedFields && Array.isArray(p.restrictedFields)) {
            p.restrictedFields.forEach((field: string) => restrictedFieldsSet.add(field));
          }
        });
        req.restrictedFields = Array.from(restrictedFieldsSet);
      }

      // If at least one granting permission has NO policyCondition, then it is completely unrestricted (unrestricted grant wins).
      const hasUnrestrictedGrant = grantingPermissions.some(
        (p) => !p.policyCondition || (Array.isArray(p.policyCondition) && p.policyCondition.length === 0)
      );

      req.checkPolicyCondition = (resource: any) => {
        if (hasUnrestrictedGrant) return true;

        const policies = grantingPermissions
          .map((p) => p.policyCondition)
          .filter((cond) => !!cond && typeof cond === 'object');

        if (policies.length === 0) return true;
        // The evaluatePolicy handles the complex JSON structure safely
        return evaluatePolicy(policies, user, resource);
      };

      setupSanitizedResponse(req, res);
      next();
    } catch (err) {
      console.error('rbacGuard error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error resolving RBAC policies.',
        traceId: req.headers['x-trace-id'] || '',
      });
    }
  };
};

/**
 * Attaches a premium helper jsonSanitized onto the response to strip restricted fields automatically.
 */
function setupSanitizedResponse(req: RBACRequest, res: Response) {
  const originalJson = res.json;

  (res as any).jsonSanitized = function (data: any) {
    if (!req.restrictedFields || req.restrictedFields.length === 0) {
      return originalJson.call(this, data);
    }

    const fieldsToStrip = req.restrictedFields;

    const sanitize = (val: any): any => {
      if (!val) return val;
      if (Array.isArray(val)) {
        return val.map(sanitize);
      }
      if (typeof val === 'object') {
        let cleanObj = val;
        if (typeof val.toObject === 'function') {
          cleanObj = val.toObject();
        } else {
          cleanObj = { ...val };
        }

        fieldsToStrip.forEach((field) => {
          if (field.includes('.')) {
            const parts = field.split('.');
            let cursor = cleanObj;
            for (let i = 0; i < parts.length - 1; i++) {
              if (cursor && cursor[parts[i]]) cursor = cursor[parts[i]];
            }
            if (cursor) delete cursor[parts[parts.length - 1]];
          } else {
            delete cleanObj[field];
          }
        });
        return cleanObj;
      }
      return val;
    };

    const sanitizedData = sanitize(data);
    return originalJson.call(this, sanitizedData);
  };
}
