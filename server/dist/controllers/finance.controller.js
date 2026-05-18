"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addFinanceRecord = exports.getFinanceSummary = void 0;
const Finance_js_1 = require("../models/Finance.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const getFinanceSummary = async (req, res) => {
    try {
        const records = await Finance_js_1.Finance.find().sort({ date: -1, createdAt: -1 });
        let totalAllocated = 0;
        let totalSpent = 0;
        records.forEach((r) => {
            if (r.type === 'ALLOCATION') {
                totalAllocated += r.amount;
            }
            else {
                totalSpent += r.amount;
            }
        });
        res.status(200).json({
            summary: {
                totalAllocated,
                totalSpent,
                remainingBalance: totalAllocated - totalSpent,
            },
            records,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getFinanceSummary = getFinanceSummary;
const addFinanceRecord = async (req, res) => {
    try {
        const { type, amount, categoryOrReason, description, date } = req.body;
        const loggedBy = req.user ? `${req.user.email} (${req.user.role})` : 'System';
        const record = await Finance_js_1.Finance.create({
            type,
            amount: Number(amount),
            categoryOrReason,
            description,
            date,
            loggedBy,
        });
        await (0, auditLog_service_js_1.createAuditLog)(type === 'ALLOCATION' ? 'FINANCE_ALLOCATION' : 'FINANCE_EXPENSE', req.user?.email || 'System', 'FINANCE', type, `${type === 'ALLOCATION' ? 'Allocated budget' : 'Logged expense'}: $${amount} for ${categoryOrReason}`);
        res.status(201).json({ record });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.addFinanceRecord = addFinanceRecord;
