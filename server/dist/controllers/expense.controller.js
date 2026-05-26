"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectExpense = exports.approveExpense = exports.getExpenses = exports.createExpense = void 0;
const Expense_js_1 = require("../models/Expense.js");
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
            attachmentUrl,
            status: 'PENDING'
        });
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
        const { id } = req.params; // Expense ID
        const { comments } = req.body;
        const expense = await Expense_js_1.Expense.findOne({ _id: id, organizationId: req.user?.organizationId });
        if (!expense) {
            res.status(404).json({ message: 'Expense not found' });
            return;
        }
        if (expense.status !== 'PENDING') {
            res.status(400).json({ message: `Expense is already ${expense.status.toLowerCase()}` });
            return;
        }
        expense.status = 'APPROVED';
        expense.approvedBy = req.user?.id;
        if (comments) {
            expense.description = expense.description
                ? `${expense.description}\n[Approval Comment]: ${comments}`
                : `[Approval Comment]: ${comments}`;
        }
        await expense.save();
        await (0, auditLog_service_js_1.createAuditLog)('EXPENSE_APPROVED', req.user?.email || 'System', 'EXPENSE', expense.id, `Approved expense claim for $${expense.amount}`, req.user?.organizationId);
        res.status(200).json({ message: 'Expense approved successfully', expense });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.approveExpense = approveExpense;
const rejectExpense = async (req, res) => {
    try {
        const { id } = req.params; // Expense ID
        const { comments } = req.body;
        const expense = await Expense_js_1.Expense.findOne({ _id: id, organizationId: req.user?.organizationId });
        if (!expense) {
            res.status(404).json({ message: 'Expense not found' });
            return;
        }
        if (expense.status !== 'PENDING') {
            res.status(400).json({ message: `Expense is already ${expense.status.toLowerCase()}` });
            return;
        }
        expense.status = 'REJECTED';
        expense.approvedBy = req.user?.id;
        if (comments) {
            expense.description = expense.description
                ? `${expense.description}\n[Rejection Comment]: ${comments}`
                : `[Rejection Comment]: ${comments}`;
        }
        await expense.save();
        await (0, auditLog_service_js_1.createAuditLog)('EXPENSE_REJECTED', req.user?.email || 'System', 'EXPENSE', expense.id, `Rejected expense claim for $${expense.amount}. Reason: ${comments || 'None'}`, req.user?.organizationId);
        res.status(200).json({ message: 'Expense rejected successfully', expense });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.rejectExpense = rejectExpense;
