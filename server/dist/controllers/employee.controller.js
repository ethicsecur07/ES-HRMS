"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployee = exports.updateEmployee = exports.createEmployee = exports.getEmployeeById = exports.getEmployees = void 0;
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const Attendance_js_1 = require("../models/Attendance.js");
const Leave_js_1 = require("../models/Leave.js");
const Payroll_js_1 = require("../models/Payroll.js");
const Permission_js_1 = require("../models/Permission.js");
const TaskReport_js_1 = require("../models/TaskReport.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const getEmployees = async (req, res) => {
    try {
        const employees = await Employee_js_1.Employee.find().sort({ createdAt: -1 });
        res.status(200).json({ employees });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployees = getEmployees;
const getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee_js_1.Employee.findById(req.params.id);
        if (!employee) {
            res.status(404).json({ message: 'Employee not found' });
            return;
        }
        res.status(200).json({ employee });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployeeById = getEmployeeById;
const createEmployee = async (req, res) => {
    try {
        const { password, ...employeeData } = req.body;
        const employee = await Employee_js_1.Employee.create(employeeData);
        const defaultPassword = password || 'EthicSec@2026';
        await User_js_1.User.create({
            name: employee.fullName,
            email: employee.email,
            password: defaultPassword,
            role: 'EMPLOYEE',
            employeeId: employee._id,
            isActive: true,
        });
        await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_CREATE', req.user?.email || 'System', 'EMPLOYEE', employee.employeeCode, `Onboarded employee ${employee.fullName}`);
        res.status(201).json({ employee });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createEmployee = createEmployee;
const updateEmployee = async (req, res) => {
    try {
        const employee = await Employee_js_1.Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!employee) {
            res.status(404).json({ message: 'Employee not found' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_UPDATE', req.user?.email || 'System', 'EMPLOYEE', employee.employeeCode, `Updated profile for ${employee.fullName}`);
        res.status(200).json({ employee });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateEmployee = updateEmployee;
const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee_js_1.Employee.findByIdAndDelete(req.params.id);
        if (!employee) {
            res.status(404).json({ message: 'Employee not found' });
            return;
        }
        await Promise.all([
            User_js_1.User.findOneAndDelete({ $or: [{ employeeId: req.params.id }, { email: employee.email }] }),
            Attendance_js_1.Attendance.deleteMany({ employeeId: req.params.id }),
            Leave_js_1.Leave.deleteMany({ employeeId: req.params.id }),
            Payroll_js_1.Payroll.deleteMany({ employeeId: req.params.id }),
            Permission_js_1.Permission.deleteMany({ employeeId: req.params.id }),
            TaskReport_js_1.TaskReport.deleteMany({ employeeId: req.params.id }),
        ]);
        await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_DELETE', req.user?.email || 'System', 'EMPLOYEE', employee.employeeCode, `Deleted record and user account for ${employee.fullName}`);
        res.status(200).json({ message: 'Employee, user account, and all associated records deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteEmployee = deleteEmployee;
