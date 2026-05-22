"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartmentById = exports.getDepartments = void 0;
const Department_js_1 = require("../models/Department.js");
/**
 * Get all departments for the authenticated user's organization.
 */
const getDepartments = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const departments = await Department_js_1.Department.find({ organizationId: orgId });
        res.status(200).json({ success: true, data: departments });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve departments.', error: error.message });
    }
};
exports.getDepartments = getDepartments;
/**
 * Get department by ID.
 */
const getDepartmentById = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const department = await Department_js_1.Department.findOne({ _id: id, organizationId: orgId });
        if (!department) {
            res.status(404).json({ success: false, message: 'Department not found.' });
            return;
        }
        res.status(200).json({ success: true, data: department });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve department.', error: error.message });
    }
};
exports.getDepartmentById = getDepartmentById;
/**
 * Create a new department.
 */
const createDepartment = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { name, code, headOfDepartment } = req.body;
        if (!name || !code) {
            res.status(400).json({ success: false, message: 'Department name and code are required.' });
            return;
        }
        const formattedCode = code.toUpperCase().trim();
        const duplicate = await Department_js_1.Department.findOne({
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
                    ? `Department with code '${formattedCode}' already exists.`
                    : `Department with name '${name}' already exists.`
            });
            return;
        }
        const newDepartment = new Department_js_1.Department({
            organizationId: orgId,
            name: name.trim(),
            code: formattedCode,
            headOfDepartment,
            isActive: true
        });
        await newDepartment.save();
        res.status(201).json({ success: true, message: 'Department created successfully.', data: newDepartment });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create department.', error: error.message });
    }
};
exports.createDepartment = createDepartment;
/**
 * Update department details.
 */
const updateDepartment = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { name, code, headOfDepartment, isActive } = req.body;
        const department = await Department_js_1.Department.findOne({ _id: id, organizationId: orgId });
        if (!department) {
            res.status(404).json({ success: false, message: 'Department not found.' });
            return;
        }
        // Check code/name duplicates if modified
        if (code || name) {
            const queryOr = [];
            if (code && code.toUpperCase().trim() !== department.code) {
                queryOr.push({ code: code.toUpperCase().trim() });
            }
            if (name && name.trim() !== department.name) {
                queryOr.push({ name: name.trim() });
            }
            if (queryOr.length > 0) {
                const duplicate = await Department_js_1.Department.findOne({
                    organizationId: orgId,
                    _id: { $ne: id },
                    $or: queryOr
                });
                if (duplicate) {
                    res.status(400).json({ success: false, message: 'A department with that name or code already exists.' });
                    return;
                }
            }
        }
        department.name = name ? name.trim() : department.name;
        department.code = code ? code.toUpperCase().trim() : department.code;
        department.headOfDepartment = headOfDepartment !== undefined ? headOfDepartment : department.headOfDepartment;
        department.isActive = isActive !== undefined ? isActive : department.isActive;
        await department.save();
        res.status(200).json({ success: true, message: 'Department updated successfully.', data: department });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update department.', error: error.message });
    }
};
exports.updateDepartment = updateDepartment;
/**
 * Soft delete a department.
 */
const deleteDepartment = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const department = await Department_js_1.Department.findOne({ _id: id, organizationId: orgId });
        if (!department) {
            res.status(404).json({ success: false, message: 'Department not found.' });
            return;
        }
        // Call custom softDelete method from softDeletePlugin
        await department.softDelete();
        res.status(200).json({ success: true, message: 'Department deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete department.', error: error.message });
    }
};
exports.deleteDepartment = deleteDepartment;
