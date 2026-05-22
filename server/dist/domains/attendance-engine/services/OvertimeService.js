"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OvertimeService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Attendance_js_1 = require("../../../models/Attendance.js");
const Shift_js_1 = require("../../../models/Shift.js");
const auditLog_service_js_1 = require("../../../services/auditLog.service.js");
class OvertimeService {
    /**
     * Calculates overtime hours for a given attendance record compared to the assigned shift or standard duration.
     */
    static async calculateOvertime(organizationId, attendanceId) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const attId = new mongoose_1.default.Types.ObjectId(attendanceId.toString());
        const attendance = await Attendance_js_1.Attendance.findOne({ _id: attId, organizationId: orgId });
        if (!attendance) {
            throw new Error('Attendance record not found.');
        }
        if (!attendance.logoutTime) {
            throw new Error('Employee must check out before overtime can be calculated.');
        }
        let shiftDuration = 8.0; // Fallback to standard 8-hour shift if none mapped
        if (attendance.shiftId) {
            const shift = await Shift_js_1.Shift.findOne({ _id: attendance.shiftId, organizationId: orgId });
            if (shift) {
                const [startH, startM] = shift.startTime.split(':').map(Number);
                const [endH, endM] = shift.endTime.split(':').map(Number);
                const startMin = startH * 60 + startM;
                let endMin = endH * 60 + endM;
                if (endMin < startMin) {
                    endMin += 24 * 60; // Overnight shift support
                }
                shiftDuration = (endMin - startMin) / 60;
            }
        }
        const workingHours = attendance.workingHours || 0;
        const overtimeHours = Math.max(0, parseFloat((workingHours - shiftDuration).toFixed(2)));
        attendance.overtime = {
            hours: overtimeHours,
            isApproved: false,
            approvedBy: undefined,
        };
        return attendance.save();
    }
    /**
     * Approves overtime hours for payroll compilation.
     */
    static async approveOvertime(organizationId, attendanceId, approverUserId, approverEmail) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const attId = new mongoose_1.default.Types.ObjectId(attendanceId.toString());
        const attendance = await Attendance_js_1.Attendance.findOne({ _id: attId, organizationId: orgId });
        if (!attendance) {
            throw new Error('Attendance record not found.');
        }
        if (!attendance.overtime || attendance.overtime.hours <= 0) {
            throw new Error('No overtime hours registered on this record to approve.');
        }
        attendance.overtime.isApproved = true;
        attendance.overtime.approvedBy = new mongoose_1.default.Types.ObjectId(approverUserId);
        await attendance.save();
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_OVERTIME_APPROVE', approverEmail, 'ATTENDANCE', attendance.id, `Approved ${attendance.overtime.hours} hours of overtime for attendance on date ${attendance.date}.`, orgId);
        return attendance;
    }
}
exports.OvertimeService = OvertimeService;
