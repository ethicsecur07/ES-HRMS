"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployee = exports.updateEmployee = exports.createEmployee = exports.getEmployeeById = exports.getEmployees = exports.getNextEmployeeCode = void 0;
const employee_service_js_1 = require("../services/employee.service.js");
const getNextEmployeeCode = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        const nextCode = await employee_service_js_1.EmployeeService.generateNextEmployeeCode(orgId);
        res.status(200).json({ nextCode });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getNextEmployeeCode = getNextEmployeeCode;
const getEmployees = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        const { search, department, designation, branchId, isActive, page, limit, sortBy, sortOrder } = req.query;
        const result = await employee_service_js_1.EmployeeService.getEmployees(orgId, {
            search: search,
            department: department,
            designation: designation,
            branchId: branchId,
            isActive: isActive,
            page: page,
            limit: limit,
            sortBy: sortBy,
            sortOrder: sortOrder,
        });
        if (res.jsonSanitized) {
            res.jsonSanitized(result);
        }
        else {
            res.status(200).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployees = getEmployees;
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId, employeeId, role } = req.user || {};
        if (!organizationId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        // Standard employee can only fetch their own profile details
        if (role === 'EMPLOYEE' && employeeId !== id) {
            res.status(403).json({ message: 'Forbidden. You can only view your own profile.' });
            return;
        }
        const employee = await employee_service_js_1.EmployeeService.getEmployeeById(id, organizationId);
        // If standard employee is viewing their own profile, clear restricted fields to display all profile info
        if (role === 'EMPLOYEE' && employeeId === id) {
            req.restrictedFields = [];
        }
        if (res.jsonSanitized) {
            res.jsonSanitized({ employee });
        }
        else {
            res.status(200).json({ employee });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployeeById = getEmployeeById;
const createEmployee = async (req, res) => {
    try {
        const { password, ...employeeData } = req.body;
        const orgId = req.user?.organizationId;
        const emailForAudit = req.user?.email || 'System';
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        const { employee, generatedPassword } = await employee_service_js_1.EmployeeService.createEmployee(employeeData, password, orgId, emailForAudit);
        res.status(201).json({ employee, generatedPassword });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.createEmployee = createEmployee;
const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        const emailForAudit = req.user?.email || 'System';
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        const employee = await employee_service_js_1.EmployeeService.updateEmployee(id, req.body, orgId, emailForAudit);
        res.status(200).json({ employee });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateEmployee = updateEmployee;
const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        const emailForAudit = req.user?.email || 'System';
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing.' });
            return;
        }
        await employee_service_js_1.EmployeeService.deleteEmployee(id, orgId, emailForAudit);
        res.status(200).json({ message: 'Employee record soft-deleted and user account revoked successfully' });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.deleteEmployee = deleteEmployee;
