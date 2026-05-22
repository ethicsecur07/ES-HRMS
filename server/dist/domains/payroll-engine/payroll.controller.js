"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayslipPDF = exports.approvePayrollRun = exports.exportFinanceJournal = exports.rollbackPayrollRun = exports.getPayrollRuns = exports.triggerPayrollRun = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const PayrollPipeline_js_1 = require("./PayrollPipeline.js");
const PayrollRun_js_1 = require("../../models/payroll/PayrollRun.js");
const FinanceExportService_js_1 = require("../finance-integration/FinanceExportService.js");
const Payroll_js_1 = require("../../models/Payroll.js");
const Payslip_js_1 = require("../../models/Payslip.js");
const Employee_js_1 = require("../../models/Employee.js");
const Organization_js_1 = require("../../models/Organization.js");
const PayslipPdfGenerator_js_1 = require("./services/PayslipPdfGenerator.js");
const triggerPayrollRun = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { runCycle } = req.body;
        if (!runCycle) {
            res.status(400).json({ message: 'runCycle (YYYY-MM) is required' });
            return;
        }
        const objectId = new mongoose_1.default.Types.ObjectId(orgId);
        const run = await PayrollPipeline_js_1.PayrollPipeline.triggerBulkProcessing(objectId, runCycle);
        res.status(202).json({ message: 'Payroll bulk processing triggered successfully', run });
    }
    catch (err) {
        next(err);
    }
};
exports.triggerPayrollRun = triggerPayrollRun;
const getPayrollRuns = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const runs = await PayrollRun_js_1.PayrollRun.find({ organizationId: orgId }).sort({ createdAt: -1 });
        res.json(runs);
    }
    catch (err) {
        next(err);
    }
};
exports.getPayrollRuns = getPayrollRuns;
const rollbackPayrollRun = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { runCycle } = req.params;
        const objectId = new mongoose_1.default.Types.ObjectId(orgId);
        const run = await PayrollPipeline_js_1.PayrollPipeline.rollbackRun(objectId, runCycle);
        res.json({ message: 'Payroll run rolled back successfully', run });
    }
    catch (err) {
        next(err);
    }
};
exports.rollbackPayrollRun = rollbackPayrollRun;
const exportFinanceJournal = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { runCycle, platform } = req.body;
        const payrolls = await Payroll_js_1.Payroll.find({ organizationId: orgId, month: runCycle, paidStatus: 'PAID' });
        if (payrolls.length === 0) {
            res.status(400).json({ message: 'No paid payrolls found for this cycle to export.' });
            return;
        }
        const exportData = await FinanceExportService_js_1.FinanceExportService.export(platform, runCycle, payrolls);
        res.json({ message: 'Export successful', data: exportData });
    }
    catch (err) {
        next(err);
    }
};
exports.exportFinanceJournal = exportFinanceJournal;
const approvePayrollRun = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { runCycle } = req.body;
        const userId = req.user?.id;
        if (!runCycle) {
            res.status(400).json({ message: 'runCycle is required' });
            return;
        }
        const orgObjectId = new mongoose_1.default.Types.ObjectId(orgId);
        const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
        const run = await PayrollPipeline_js_1.PayrollPipeline.approveRun(orgObjectId, runCycle, userObjectId);
        res.json({ message: 'Payroll run approved and finalized successfully', run });
    }
    catch (err) {
        next(err);
    }
};
exports.approvePayrollRun = approvePayrollRun;
const getPayslipPDF = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { payrollId } = req.params;
        // Fetch the payroll record
        const payroll = await Payroll_js_1.Payroll.findOne({ _id: payrollId, organizationId: orgId });
        if (!payroll) {
            res.status(404).json({ message: 'Payroll record not found.' });
            return;
        }
        // Fetch employee details
        const employee = await Employee_js_1.Employee.findOne({ _id: payroll.employeeId, organizationId: orgId });
        if (!employee) {
            res.status(404).json({ message: 'Employee not found.' });
            return;
        }
        // Fetch organization details
        const organization = await Organization_js_1.Organization.findById(orgId);
        if (!organization) {
            res.status(404).json({ message: 'Organization not found.' });
            return;
        }
        // Fetch the generated payslip details
        const payslip = await Payslip_js_1.Payslip.findOne({ payrollId: payroll._id, organizationId: orgId });
        if (!payslip) {
            res.status(404).json({ message: 'Payslip record not found for this payroll. Please run payroll calculation first.' });
            return;
        }
        // Set Response Headers for PDF streaming
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payslip_${employee.employeeCode}_${payroll.month}.pdf`);
        // Generate and stream PDF to the client
        await PayslipPdfGenerator_js_1.PayslipPdfGenerator.generate(payslip, employee, organization, res);
    }
    catch (err) {
        next(err);
    }
};
exports.getPayslipPDF = getPayslipPDF;
