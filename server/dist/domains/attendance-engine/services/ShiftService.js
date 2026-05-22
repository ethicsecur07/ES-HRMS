"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Shift_js_1 = require("../../../models/Shift.js");
const AdvancedAttendanceEngine_js_1 = require("../../../models/AdvancedAttendanceEngine.js");
const Employee_js_1 = require("../../../models/Employee.js");
class ShiftService {
    /**
     * Creates a new Shift. Enforces name uniqueness within the tenant organization.
     */
    static async createShift(organizationId, shiftData) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const existing = await Shift_js_1.Shift.findOne({ organizationId: orgId, name: shiftData.name });
        if (existing) {
            throw new Error(`A shift with name '${shiftData.name}' already exists in this organization.`);
        }
        const shift = new Shift_js_1.Shift({
            ...shiftData,
            organizationId: orgId,
        });
        return shift.save();
    }
    /**
     * Updates an existing Shift.
     */
    static async updateShift(organizationId, shiftId, updateData) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const shift = await Shift_js_1.Shift.findOneAndUpdate({ _id: shiftId, organizationId: orgId }, updateData, { new: true });
        if (!shift) {
            throw new Error('Shift not found or unauthorized.');
        }
        return shift;
    }
    /**
     * Soft deletes a Shift if no active rotational rosters are using it.
     */
    static async deleteShift(organizationId, shiftId) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const id = new mongoose_1.default.Types.ObjectId(shiftId);
        // Check if shift is used in any active rotation
        const rotationInUse = await AdvancedAttendanceEngine_js_1.ShiftRotation.findOne({
            organizationId: orgId,
            shifts: id,
            isActive: true,
        });
        if (rotationInUse) {
            throw new Error('Cannot delete shift because it is currently in use in active shift rotations.');
        }
        const shift = await Shift_js_1.Shift.findOne({ _id: id, organizationId: orgId });
        if (!shift) {
            throw new Error('Shift not found or unauthorized.');
        }
        if (typeof shift.softDelete === 'function') {
            await shift.softDelete();
        }
        else {
            await shift.deleteOne();
        }
    }
    /**
     * Assigns a rotational shift schedule to an employee.
     * Transactional and ensures both target employee and shifts belong to the user's organization.
     */
    static async assignShiftRotation(organizationId, employeeId, shiftIds, rotationCycleWeeks, startDate) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const empId = new mongoose_1.default.Types.ObjectId(employeeId);
        const parsedStart = startDate ? new Date(startDate) : new Date();
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. Validate employee exists in organization
            const employee = await Employee_js_1.Employee.findOne({ _id: empId, organizationId: orgId }).session(session);
            if (!employee) {
                throw new Error('Target employee not found in this organization.');
            }
            // 2. Validate all shifts belong to organization
            const objectShiftIds = shiftIds.map(id => new mongoose_1.default.Types.ObjectId(id));
            const validShiftsCount = await Shift_js_1.Shift.countDocuments({
                _id: { $in: objectShiftIds },
                organizationId: orgId,
                isActive: true,
            }).session(session);
            if (validShiftsCount !== shiftIds.length) {
                throw new Error('One or more of the assigned shifts are invalid or belong to another organization.');
            }
            // 3. Deactivate any existing rotations for this employee to prevent overlap conflict
            await AdvancedAttendanceEngine_js_1.ShiftRotation.updateMany({ employeeId: empId, organizationId: orgId, isActive: true }, { isActive: false }, { session });
            // 4. Create new rotation
            const [rotation] = await AdvancedAttendanceEngine_js_1.ShiftRotation.create([
                {
                    organizationId: orgId,
                    employeeId: empId,
                    shifts: objectShiftIds,
                    rotationCycleWeeks,
                    startDate: parsedStart,
                    isActive: true,
                },
            ], { session });
            await session.commitTransaction();
            return rotation;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Resolves the active Shift configuration for a specific employee on a given date.
     */
    static async getAssignedShiftForDate(organizationId, employeeId, date) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const empId = new mongoose_1.default.Types.ObjectId(employeeId.toString());
        // Find the active rotation assignment
        const rotation = await AdvancedAttendanceEngine_js_1.ShiftRotation.findOne({
            employeeId: empId,
            organizationId: orgId,
            isActive: true,
            startDate: { $lte: date },
        }).populate('shifts');
        if (!rotation || !rotation.shifts || rotation.shifts.length === 0) {
            return null;
        }
        const start = new Date(rotation.startDate);
        // Normalize date timings to midnight UTC/Local comparison
        const dayDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff < 0) {
            return rotation.shifts[0];
        }
        const cycleWeeks = rotation.rotationCycleWeeks || 1;
        const weekDiff = Math.floor(dayDiff / 7);
        const index = Math.floor(weekDiff / cycleWeeks) % rotation.shifts.length;
        const resolvedShift = rotation.shifts[index];
        // Check if the weekday is part of the shift's workingDays
        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const dayOfWeek = date.getDay();
        if (resolvedShift && resolvedShift.workingDays.includes(dayOfWeek)) {
            return resolvedShift;
        }
        return null; // Return null if it is a non-working day for this shift
    }
}
exports.ShiftService = ShiftService;
