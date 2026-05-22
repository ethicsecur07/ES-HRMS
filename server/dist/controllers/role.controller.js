"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.updateRole = exports.createRole = exports.getRoleById = exports.getRoles = void 0;
const Role_js_1 = require("../models/Role.js");
/**
 * Get all roles for the authenticated user's organization.
 */
const getRoles = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const roles = await Role_js_1.Role.find({ organizationId: orgId }).populate('parentRoleId', 'name code');
        res.status(200).json({ success: true, data: roles });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve roles.', error: error.message });
    }
};
exports.getRoles = getRoles;
/**
 * Get a role by ID.
 */
const getRoleById = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const role = await Role_js_1.Role.findOne({ _id: id, organizationId: orgId }).populate('parentRoleId', 'name code');
        if (!role) {
            res.status(404).json({ success: false, message: 'Role not found.' });
            return;
        }
        res.status(200).json({ success: true, data: role });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve role.', error: error.message });
    }
};
exports.getRoleById = getRoleById;
/**
 * Create a new role.
 */
const createRole = async (req, res) => {
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
        const duplicate = await Role_js_1.Role.findOne({
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
        if (parentRoleId) {
            const parentExists = await Role_js_1.Role.findOne({ _id: parentRoleId, organizationId: orgId });
            if (!parentExists) {
                res.status(400).json({ success: false, message: 'Specified parent role does not exist.' });
                return;
            }
        }
        const newRole = new Role_js_1.Role({
            organizationId: orgId,
            name: name.trim(),
            code: formattedCode,
            description,
            parentRoleId: parentRoleId || null,
            isActive: isActive ?? true
        });
        await newRole.save();
        res.status(201).json({ success: true, message: 'Role created successfully.', data: newRole });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create role.', error: error.message });
    }
};
exports.createRole = createRole;
/**
 * Update a role.
 */
const updateRole = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { name, code, description, parentRoleId, isActive } = req.body;
        const role = await Role_js_1.Role.findOne({ _id: id, organizationId: orgId });
        if (!role) {
            res.status(404).json({ success: false, message: 'Role not found.' });
            return;
        }
        // Do not allow modifying ADMIN role code or parent
        if (role.code === 'ADMIN' && (code && code !== 'ADMIN' || parentRoleId)) {
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
                const duplicate = await Role_js_1.Role.findOne({
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
        if (parentRoleId) {
            if (parentRoleId.toString() === id) {
                res.status(400).json({ success: false, message: 'A role cannot be its own parent.' });
                return;
            }
            // Check if the assigned parent has this role as parent (prevent simple cyclic loop)
            const parentRoleObj = await Role_js_1.Role.findOne({ _id: parentRoleId, organizationId: orgId });
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
        role.parentRoleId = parentRoleId !== undefined ? (parentRoleId || null) : role.parentRoleId;
        role.isActive = isActive !== undefined ? isActive : role.isActive;
        await role.save();
        res.status(200).json({ success: true, message: 'Role updated successfully.', data: role });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update role.', error: error.message });
    }
};
exports.updateRole = updateRole;
/**
 * Delete a role.
 */
const deleteRole = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const role = await Role_js_1.Role.findOne({ _id: id, organizationId: orgId });
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
        const childRoleExists = await Role_js_1.Role.findOne({ parentRoleId: id, organizationId: orgId });
        if (childRoleExists) {
            res.status(400).json({
                success: false,
                message: `Cannot delete role. It is a parent to the '${childRoleExists.name}' role. Reassign the parent of child roles first.`
            });
            return;
        }
        await Role_js_1.Role.deleteOne({ _id: id, organizationId: orgId });
        res.status(200).json({ success: true, message: 'Role deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete role.', error: error.message });
    }
};
exports.deleteRole = deleteRole;
