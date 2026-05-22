"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayslipPdf = exports.updatePayrollStatus = exports.generatePayroll = exports.getPayrolls = void 0;
const Payroll_js_1 = require("../models/Payroll.js");
const payroll_service_js_1 = require("../services/payroll.service.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const PayrollRun_js_1 = require("../models/payroll/PayrollRun.js");
const Payslip_js_1 = require("../models/Payslip.js");
const payslipPdf_service_js_1 = require("../services/payslipPdf.service.js");
const getPayrolls = async (req, res) => {
    try {
        const authReq = req;
        const payrolls = await Payroll_js_1.Payroll.find({ organizationId: authReq.user?.organizationId })
            .populate('employeeId')
            .sort({ month: -1 });
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
        const payrolls = await (0, payroll_service_js_1.calculateMonthlyPayroll)(month, req.user?.organizationId);
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_GENERATE', req.user?.email || 'Admin', 'PAYROLL', `Period: ${month}`, `Generated payroll for ${payrolls.length} employees`, req.user?.organizationId);
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
        const payroll = await Payroll_js_1.Payroll.findOne({ _id: id, organizationId: req.user?.organizationId });
        if (!payroll) {
            res.status(404).json({ message: 'Payroll record not found' });
            return;
        }
        // Check if the cycle is locked or completed
        const run = await PayrollRun_js_1.PayrollRun.findOne({
            organizationId: req.user?.organizationId,
            runCycle: payroll.month
        });
        if (run && ['LOCKED', 'COMPLETED'].includes(run.status)) {
            res.status(400).json({ message: `Cannot modify individual payroll status when the run cycle is ${run.status}.` });
            return;
        }
        payroll.paidStatus = paidStatus;
        payroll.paymentDate = paidStatus === 'PAID' ? new Date() : undefined;
        await payroll.save();
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_STATUS_UPDATE', req.user?.email || 'Admin', 'PAYROLL', payroll.id, `Updated disbursement status to ${paidStatus}`, req.user?.organizationId);
        res.status(200).json({ payroll });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updatePayrollStatus = updatePayrollStatus;
const getPayslipPdf = async (req, res) => {
    const { id } = req.params; // payrollId
    try {
        const payslip = await Payslip_js_1.Payslip.findOne({ payrollId: id, organizationId: req.user?.organizationId });
        if (!payslip) {
            res.status(404).json({ message: 'Payslip not found' });
            return;
        }
        const pdfBuffer = await (0, payslipPdf_service_js_1.generatePayslipPdf)(payslip);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslip.month}.pdf`);
        res.status(200).send(pdfBuffer);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPayslipPdf = getPayslipPdf;
