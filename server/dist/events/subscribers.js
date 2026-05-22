"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSubscribers = void 0;
const EventBus_js_1 = require("./EventBus.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const Payroll_js_1 = require("../models/Payroll.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const registerSubscribers = () => {
    // Listen for leave.approved events
    EventBus_js_1.eventBus.subscribe('leave.approved', async (payload) => {
        try {
            console.log(`[EVENT HANDLER] Processing 'leave.approved' async tasks for leave ${payload.leaveId}`);
            // 1. Update Payroll Deductions
            // Let's assume each day of unpaid leave deducts some amount, or we log it in their current monthly payroll record.
            const deductionAmount = payload.totalDays * 1000; // Mock calculation: $1000 per day
            const payrollRecord = await Payroll_js_1.Payroll.findOneAndUpdate({ organizationId: payload.organizationId, employeeId: payload.employeeId, month: payload.month }, {
                $inc: { deductions: deductionAmount },
                $setOnInsert: { organizationId: payload.organizationId, baseSalary: 50000, finalSalary: 50000 - deductionAmount }
            }, { new: true, upsert: true });
            // Re-calculate final salary: baseSalary + bonus - deductions
            if (payrollRecord) {
                payrollRecord.finalSalary = payrollRecord.baseSalary + payrollRecord.bonus - payrollRecord.deductions;
                await payrollRecord.save();
                console.log(`[EVENT HANDLER] Payroll updated. New deductions: ${payrollRecord.deductions}`);
            }
            // 2. Emit Real-Time Socket Event
            const io = (0, socketHandler_js_1.getIO)();
            if (io) {
                // Emit to the specific employee or general update
                io.emit('notification', {
                    employeeId: payload.employeeId,
                    title: 'Leave Approved',
                    message: `Your leave request for ${payload.totalDays} day(s) has been approved.`,
                    type: 'INFO'
                });
                console.log(`[EVENT HANDLER] Emitted socket notification to employee ${payload.employeeId}`);
            }
            // 3. Create Audit Trail Log
            await (0, auditLog_service_js_1.createAuditLog)('LEAVE_APPROVED_EVENT', payload.approvedBy, 'LEAVES', payload.leaveId, `Leave approved for ${payload.employeeName} (${payload.totalDays} days). Payroll deductions updated by ${deductionAmount}.`, payload.organizationId);
            console.log(`[EVENT HANDLER] Audit log created successfully.`);
        }
        catch (err) {
            console.error("[EVENT HANDLER ERROR] failed processing leave.approved:", err);
        }
    });
    console.log('🔔 Domain Event Bus subscribers registered successfully.');
};
exports.registerSubscribers = registerSubscribers;
