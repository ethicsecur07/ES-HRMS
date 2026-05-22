"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectExpense = exports.approveExpense = exports.getExpenses = exports.createExpense = void 0;
const Expense_js_1 = require("../models/Expense.js");
const expenseWorkflow_service_js_1 = require("../services/expenseWorkflow.service.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const createExpense = async (req, res) => {
    try {
        const { amount, category, reason, description, date, attachmentUrl } = req.body;
        const expense = await Expense_js_1.Expense.create({
            organizationId: req.user?.organizationId,
            submittedBy: req.user?.id,
            amount,
            category,
            reason,
            description,
            date,
            attachmentUrl
        });
        await (0, expenseWorkflow_service_js_1.initiateExpenseWorkflow)(expense._id.toString(), req.user?.organizationId);
        await (0, auditLog_service_js_1.createAuditLog)('EXPENSE_CREATED', req.user?.email || 'System', 'EXPENSE', expense.id, `Created expense claim for $${amount}`, req.user?.organizationId);
        res.status(201).json({ expense });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createExpense = createExpense;
const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense_js_1.Expense.find({ organizationId: req.user?.organizationId })
            .populate('submittedBy', 'firstName lastName email')
            .populate('workflowInstanceId')
            .sort({ createdAt: -1 });
        res.status(200).json({ expenses });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getExpenses = getExpenses;
const approveExpense = async (req, res) => {
    try {
        const { id } = req.params; // Workflow instance ID
        const { comments } = req.body;
        await (0, expenseWorkflow_service_js_1.processExpenseApproval)(id, req.user?.id, 'APPROVE', comments);
        res.status(200).json({ message: 'Expense approved successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.approveExpense = approveExpense;
const rejectExpense = async (req, res) => {
    try {
        const { id } = req.params; // Workflow instance ID
        const { comments } = req.body;
        await (0, expenseWorkflow_service_js_1.processExpenseApproval)(id, req.user?.id, 'REJECT', comments);
        res.status(200).json({ message: 'Expense rejected successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.rejectExpense = rejectExpense;
