"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePayrollStatus = exports.generatePayroll = exports.getPayrolls = void 0;
const Payroll_js_1 = require("../models/Payroll.js");
const payroll_service_js_1 = require("../services/payroll.service.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const getPayrolls = async (req, res) => {
    try {
        const payrolls = await Payroll_js_1.Payroll.find().populate('employeeId').sort({ month: -1 });
        res.status(200).json({ payrolls });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPayrolls = getPayrolls;
const generatePayroll = async (req, res) => {
    const { month } = req.body;
    try {
        const payrolls = await (0, payroll_service_js_1.calculateMonthlyPayroll)(month);
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_GENERATE', req.user?.email || 'Admin', 'PAYROLL', `Period: ${month}`, `Generated payroll for ${payrolls.length} employees`);
        res.status(200).json({ payrolls });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.generatePayroll = generatePayroll;
const updatePayrollStatus = async (req, res) => {
    const { id } = req.params;
    const { paidStatus } = req.body;
    try {
        const payroll = await Payroll_js_1.Payroll.findByIdAndUpdate(id, { paidStatus, paymentDate: paidStatus === 'PAID' ? new Date() : undefined }, { new: true }).populate('employeeId');
        if (!payroll) {
            res.status(404).json({ message: 'Payroll record not found' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_STATUS_UPDATE', req.user?.email || 'Admin', 'PAYROLL', payroll.id, `Updated disbursement status to ${paidStatus}`);
        res.status(200).json({ payroll });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updatePayrollStatus = updatePayrollStatus;
