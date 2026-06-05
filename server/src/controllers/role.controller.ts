import { Response } from 'express';
import { Role } from '../models/Role.js';
import { AuthRequest } from '../types/index.js';
import { RoleMember } from '../models/RoleMember.js';
import mongoose from 'mongoose';
import { redisClearPattern } from '../utils/redisClient.js';
import { User } from '../models/User.js';
import { ROLES } from '../constants/index.js';

/**
 * Get all roles for the authenticated user's organization.
 */
export const getRoles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const roles = await Role.find({ organizationId: orgId }).populate('parentRoleId', 'name code').lean();
    
    // Fetch all role members for this organization
    const members = await RoleMember.find({ organizationId: orgId })
      .populate({
        path: 'userId',
        select: 'name email role employeeId isActive',
      })
      .lean();

    const rolesWithMembers = roles.map((role: any) => {
      const roleMembers = members.filter((m: any) => m.roleId.toString() === role._id.toString());
      return {
        ...role,
        members: roleMembers.map((m: any) => m.userId).filter(Boolean),
      };
    });

    res.status(200).json({ success: true, data: rolesWithMembers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve roles.', error: error.message });
  }
};

/**
 * Get a role by ID.
 */
export const getRoleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const role = await Role.findOne({ _id: id, organizationId: orgId }).populate('parentRoleId', 'name code').lean();
    if (!role) {
      res.status(404).json({ success: false, message: 'Role not found.' });
      return;
    }

    const members = await RoleMember.find({ roleId: id, organizationId: orgId })
      .populate({
        path: 'userId',
        select: 'name email role employeeId isActive',
      })
      .lean();

    const roleWithMembers = {
      ...role,
      members: members.map((m: any) => m.userId).filter(Boolean),
    };

    res.status(200).json({ success: true, data: roleWithMembers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve role.', error: error.message });
  }
};

/**
 * Create a new role.
 */
export const createRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const { name, code, description, parentRoleId, isActive } = req.body;

    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Role name and code are required.' });
      return;
    }

    // Check for duplicate code or name within the organization
    const formattedCode = code.toUpperCase().trim();
    const duplicate = await Role.findOne({
      organizationId: orgId,
      $or: [
        { code: formattedCode },
        { name: name.trim() }
      ]
    });

    if (duplicate) {
      res.status(400).json({
        success: false,
        message: duplicate.code === formattedCode
          ? `Role with code '${formattedCode}' already exists.`
          : `Role with name '${name}' already exists.`
      });
      return;
    }

    // Validate parentRoleId exists in this org
    let resolvedParentRoleId = parentRoleId;
    if (parentRoleId && typeof parentRoleId === 'object') {
      resolvedParentRoleId = (parentRoleId as any)._id || parentRoleId;
    }
    if (resolvedParentRoleId === 'null' || resolvedParentRoleId === 'undefined' || resolvedParentRoleId === '') {
      resolvedParentRoleId = null;
    }

    if (resolvedParentRoleId) {
      const parentExists = await Role.findOne({ _id: resolvedParentRoleId, organizationId: orgId });
      if (!parentExists) {
        res.status(400).json({ success: false, message: 'Specified parent role does not exist.' });
        return;
      }
    }

    const newRole = new Role({
      organizationId: orgId,
      name: name.trim(),
      code: formattedCode,
      description,
      parentRoleId: resolvedParentRoleId || null,
      isActive: isActive ?? true
    });

    await newRole.save();

    // Invalidate Redis RBAC cache for this organization
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(201).json({ success: true, message: 'Role created successfully.', data: newRole });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create role.', error: error.message });
  }
};

/**
 * Update a role.
 */
export const updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const { name, code, description, parentRoleId, isActive } = req.body;

    const role = await Role.findOne({ _id: id, organizationId: orgId });
    if (!role) {
      res.status(404).json({ success: false, message: 'Role not found.' });
      return;
    }

    let resolvedParentRoleId = parentRoleId;
    if (parentRoleId && typeof parentRoleId === 'object') {
      resolvedParentRoleId = (parentRoleId as any)._id || parentRoleId;
    }
    if (resolvedParentRoleId === 'null' || resolvedParentRoleId === 'undefined' || resolvedParentRoleId === '') {
      resolvedParentRoleId = null;
    }

    // Do not allow modifying ADMIN role code or parent hierarchy
    const currentParentIdStr = role.parentRoleId?.toString() || '';
    const newParentIdStr = resolvedParentRoleId ? resolvedParentRoleId.toString() : '';
    if (role.code === 'ADMIN' && (
      (code && code !== 'ADMIN') ||
      (parentRoleId !== undefined && newParentIdStr !== currentParentIdStr)
    )) {
      res.status(400).json({ success: false, message: 'System Administrator role code and hierarchy cannot be modified.' });
      return;
    }

    // Check code/name duplicates if modified
    if (code || name) {
      const queryOr = [];
      if (code && code.toUpperCase().trim() !== role.code) {
        queryOr.push({ code: code.toUpperCase().trim() });
      }
      if (name && name.trim() !== role.name) {
        queryOr.push({ name: name.trim() });
      }

      if (queryOr.length > 0) {
        const duplicate = await Role.findOne({
          organizationId: orgId,
          _id: { $ne: id },
          $or: queryOr
        });

        if (duplicate) {
          res.status(400).json({ success: false, message: 'A role with that name or code already exists.' });
          return;
        }
      }
    }

    // Validate parentRoleId if modified (prevent cyclic dependencies)
    if (resolvedParentRoleId) {
      if (resolvedParentRoleId.toString() === id) {
        res.status(400).json({ success: false, message: 'A role cannot be its own parent.' });
        return;
      }

      // Check if the assigned parent has this role as parent (prevent simple cyclic loop)
      const parentRoleObj = await Role.findOne({ _id: resolvedParentRoleId, organizationId: orgId });
      if (!parentRoleObj) {
        res.status(400).json({ success: false, message: 'Specified parent role does not exist.' });
        return;
      }

      if (parentRoleObj.parentRoleId?.toString() === id) {
        res.status(400).json({ success: false, message: 'Cyclic inheritance detected. Parent role cannot depend on this role.' });
        return;
      }
    }

    role.name = name ? name.trim() : role.name;
    role.code = code ? code.toUpperCase().trim() : role.code;
    role.description = description !== undefined ? description : role.description;
    role.parentRoleId = parentRoleId !== undefined ? (resolvedParentRoleId || null) : role.parentRoleId;
    role.isActive = isActive !== undefined ? isActive : role.isActive;

    await role.save();

    // Invalidate Redis RBAC cache for this organization
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(200).json({ success: true, message: 'Role updated successfully.', data: role });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update role.', error: error.message });
  }
};

/**
 * Delete a role.
 */
export const deleteRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    const role = await Role.findOne({ _id: id, organizationId: orgId });
    if (!role) {
      res.status(404).json({ success: false, message: 'Role not found.' });
      return;
    }

    // Core roles (ADMIN, EMPLOYEE) should not be deleted
    if (['ADMIN', 'EMPLOYEE', 'HR'].includes(role.code)) {
      res.status(400).json({ success: false, message: `System role '${role.code}' cannot be deleted.` });
      return;
    }

    // Check if this role is currently a parent for other roles
    const childRoleExists = await Role.findOne({ parentRoleId: id, organizationId: orgId });
    if (childRoleExists) {
      res.status(400).json({
        success: false,
        message: `Cannot delete role. It is a parent to the '${childRoleExists.name}' role. Reassign the parent of child roles first.`
      });
      return;
    }

    await Role.deleteOne({ _id: id, organizationId: orgId });

    // Invalidate Redis RBAC cache for this organization
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(200).json({ success: true, message: 'Role deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete role.', error: error.message });
  }
};

/**
 * Get all members of a role.
 */
export const getRoleMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    // Verify role exists in this organization
    const roleExists = await Role.findOne({ _id: id, organizationId: orgId });
    if (!roleExists) {
      res.status(404).json({ success: false, message: 'Role not found.' });
      return;
    }

    const members = await RoleMember.find({ roleId: id, organizationId: orgId })
      .populate({
        path: 'userId',
        select: 'name email role employeeId isActive',
        populate: {
          path: 'employeeId',
          select: 'employeeCode department designation'
        }
      });

    res.status(200).json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve role members.', error: error.message });
  }
};

/**
 * Assign members to a role (overwrite existing members list).
 */
export const updateRoleMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { userIds } = req.body; // Array of user IDs to set as members

    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
      return;
    }

    if (!Array.isArray(userIds)) {
      res.status(400).json({ success: false, message: 'userIds must be an array.' });
      return;
    }

    // Verify role exists in this organization
    const role = await Role.findOne({ _id: id, organizationId: orgId }).session(session);
    if (!role) {
      res.status(404).json({ success: false, message: 'Role not found.' });
      return;
    }

    // Find previous members before deletion to manage system role updates
    const systemRoles = Object.values(ROLES);
    const isSystemRole = systemRoles.includes(role.code as any);
    let previousUserIds: string[] = [];

    if (isSystemRole) {
      const previousMembers = await RoleMember.find({ roleId: id, organizationId: orgId }).session(session);
      previousUserIds = previousMembers.map(m => m.userId.toString());
    }

    // Remove current members of this role
    await RoleMember.deleteMany({ roleId: id, organizationId: orgId }).session(session);

    // Create new members
    if (userIds.length > 0) {
      const records = userIds.map((uid: string) => ({
        organizationId: orgId,
        roleId: id,
        userId: new mongoose.Types.ObjectId(uid)
      }));
      await RoleMember.insertMany(records, { session });
    }

    // Synchronize User.role if it's a system role
    if (isSystemRole) {
      const newUserIdsStrings = userIds.map(uid => uid.toString());

      // 1. Promote new members to the system role
      if (newUserIdsStrings.length > 0) {
        await User.updateMany(
          { _id: { $in: newUserIdsStrings }, organizationId: orgId },
          { $set: { role: role.code } }
        ).session(session);
      }

      // 2. Revert demoted members back to EMPLOYEE role
      const demotedUserIds = previousUserIds.filter(uid => !newUserIdsStrings.includes(uid));
      if (demotedUserIds.length > 0) {
        await User.updateMany(
          { _id: { $in: demotedUserIds }, organizationId: orgId },
          { $set: { role: 'EMPLOYEE' } }
        ).session(session);
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Invalidate Redis RBAC cache for this organization to apply membership updates immediately
    await redisClearPattern(`rbac:${orgId}:*`);

    res.status(200).json({ success: true, message: 'Role members updated successfully.' });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: 'Failed to update role members.', error: error.message });
  }
};

