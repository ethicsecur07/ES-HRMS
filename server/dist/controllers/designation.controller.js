"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDesignation = exports.updateDesignation = exports.createDesignation = exports.getDesignationById = exports.getDesignations = void 0;
const Designation_js_1 = require("../models/Designation.js");
const Department_js_1 = require("../models/Department.js");
/**
 * Get all designations for the authenticated user's organization, optionally filtered by departmentId.
 */
const getDesignations = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { departmentId } = req.query;
        const query = { organizationId: orgId };
        if (departmentId) {
            query.departmentId = departmentId;
        }
        const designations = await Designation_js_1.Designation.find(query).populate('departmentId', 'name code');
        res.status(200).json({ success: true, data: designations });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve designations.', error: error.message });
    }
};
exports.getDesignations = getDesignations;
/**
 * Get designation by ID.
 */
const getDesignationById = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const designation = await Designation_js_1.Designation.findOne({ _id: id, organizationId: orgId }).populate('departmentId', 'name code');
        if (!designation) {
            res.status(404).json({ success: false, message: 'Designation not found.' });
            return;
        }
        res.status(200).json({ success: true, data: designation });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve designation.', error: error.message });
    }
};
exports.getDesignationById = getDesignationById;
/**
 * Create a new designation.
 */
const createDesignation = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { departmentId, name, code } = req.body;
        if (!departmentId || !name || !code) {
            res.status(400).json({ success: false, message: 'Department ID, name, and code are required.' });
            return;
        }
        // Verify department exists in the organization
        const department = await Department_js_1.Department.findOne({ _id: departmentId, organizationId: orgId });
        if (!department) {
            res.status(400).json({ success: false, message: 'Specified Department does not exist in this organization.' });
            return;
        }
        const formattedCode = code.toUpperCase().trim();
        const duplicate = await Designation_js_1.Designation.findOne({
            organizationId: orgId,
            departmentId,
            $or: [
                { code: formattedCode },
                { name: name.trim() }
            ]
        });
        if (duplicate) {
            res.status(400).json({
                success: false,
                message: duplicate.code === formattedCode
                    ? `Designation with code '${formattedCode}' already exists in this department.`
                    : `Designation with name '${name}' already exists in this department.`
            });
            return;
        }
        const newDesignation = new Designation_js_1.Designation({
            organizationId: orgId,
            departmentId,
            name: name.trim(),
            code: formattedCode,
            isActive: true
        });
        await newDesignation.save();
        res.status(201).json({ success: true, message: 'Designation created successfully.', data: newDesignation });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create designation.', error: error.message });
    }
};
exports.createDesignation = createDesignation;
/**
 * Update designation details.
 */
const updateDesignation = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const { departmentId, name, code, isActive } = req.body;
        const designation = await Designation_js_1.Designation.findOne({ _id: id, organizationId: orgId });
        if (!designation) {
            res.status(404).json({ success: false, message: 'Designation not found.' });
            return;
        }
        const deptId = departmentId || designation.departmentId;
        if (departmentId && departmentId !== designation.departmentId.toString()) {
            const department = await Department_js_1.Department.findOne({ _id: departmentId, organizationId: orgId });
            if (!department) {
                res.status(400).json({ success: false, message: 'Specified Department does not exist in this organization.' });
                return;
            }
        }
        // Check duplicates if name/code or department modified
        if (code || name || departmentId) {
            const queryOr = [];
            if (code && code.toUpperCase().trim() !== designation.code) {
                queryOr.push({ code: code.toUpperCase().trim() });
            }
            if (name && name.trim() !== designation.name) {
                queryOr.push({ name: name.trim() });
            }
            // If code/name not changed, but department changed, check if current name/code already exists in target department
            if (queryOr.length === 0) {
                queryOr.push({ name: designation.name });
                queryOr.push({ code: designation.code });
            }
            const duplicate = await Designation_js_1.Designation.findOne({
                organizationId: orgId,
                departmentId: deptId,
                _id: { $ne: id },
                $or: queryOr
            });
            if (duplicate) {
                res.status(400).json({ success: false, message: 'A designation with that name or code already exists in this department.' });
                return;
            }
        }
        designation.departmentId = deptId;
        designation.name = name ? name.trim() : designation.name;
        designation.code = code ? code.toUpperCase().trim() : designation.code;
        designation.isActive = isActive !== undefined ? isActive : designation.isActive;
        await designation.save();
        res.status(200).json({ success: true, message: 'Designation updated successfully.', data: designation });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update designation.', error: error.message });
    }
};
exports.updateDesignation = updateDesignation;
/**
 * Soft delete a designation.
 */
const deleteDesignation = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized. Organization not found.' });
            return;
        }
        const designation = await Designation_js_1.Designation.findOne({ _id: id, organizationId: orgId });
        if (!designation) {
            res.status(404).json({ success: false, message: 'Designation not found.' });
            return;
        }
        await designation.softDelete();
        res.status(200).json({ success: true, message: 'Designation deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete designation.', error: error.message });
    }
};
exports.deleteDesignation = deleteDesignation;
