import mongoose from 'mongoose';
import { Shift, IShift } from '../../../models/Shift.js';
import { ShiftRotation, IShiftRotation } from '../../../models/AdvancedAttendanceEngine.js';
import { Employee } from '../../../models/Employee.js';

export class ShiftService {
  /**
   * Creates a new Shift. Enforces name uniqueness within the tenant organization.
   */
  static async createShift(organizationId: string | mongoose.Types.ObjectId, shiftData: Partial<IShift>): Promise<IShift> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const existing = await Shift.findOne({ organizationId: orgId, name: shiftData.name });
    if (existing) {
      throw new Error(`A shift with name '${shiftData.name}' already exists in this organization.`);
    }

    const shift = new Shift({
      ...shiftData,
      organizationId: orgId,
    });
    return shift.save();
  }

  /**
   * Updates an existing Shift.
   */
  static async updateShift(organizationId: string | mongoose.Types.ObjectId, shiftId: string, updateData: Partial<IShift>): Promise<IShift> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const shift = await Shift.findOneAndUpdate(
      { _id: shiftId, organizationId: orgId },
      updateData,
      { new: true }
    );
    if (!shift) {
      throw new Error('Shift not found or unauthorized.');
    }
    return shift;
  }

  /**
   * Soft deletes a Shift if no active rotational rosters are using it.
   */
  static async deleteShift(organizationId: string | mongoose.Types.ObjectId, shiftId: string): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const id = new mongoose.Types.ObjectId(shiftId);

    // Check if shift is used in any active rotation
    const rotationInUse = await ShiftRotation.findOne({
      organizationId: orgId,
      shifts: id,
      isActive: true,
    });
    if (rotationInUse) {
      throw new Error('Cannot delete shift because it is currently in use in active shift rotations.');
    }

    const shift = await Shift.findOne({ _id: id, organizationId: orgId });
    if (!shift) {
      throw new Error('Shift not found or unauthorized.');
    }

    if (typeof (shift as any).softDelete === 'function') {
      await (shift as any).softDelete();
    } else {
      await shift.deleteOne();
    }
  }

  /**
   * Assigns a rotational shift schedule to an employee.
   * Transactional and ensures both target employee and shifts belong to the user's organization.
   */
  static async assignShiftRotation(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string,
    shiftIds: string[],
    rotationCycleWeeks: number,
    startDate?: string | Date
  ): Promise<IShiftRotation> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId);
    const parsedStart = startDate ? new Date(startDate) : new Date();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate employee exists in organization
      const employee = await Employee.findOne({ _id: empId, organizationId: orgId }).session(session);
      if (!employee) {
        throw new Error('Target employee not found in this organization.');
      }

      // 2. Validate all shifts belong to organization
      const objectShiftIds = shiftIds.map(id => new mongoose.Types.ObjectId(id));
      const validShiftsCount = await Shift.countDocuments({
        _id: { $in: objectShiftIds },
        organizationId: orgId,
        isActive: true,
      }).session(session);

      if (validShiftsCount !== shiftIds.length) {
        throw new Error('One or more of the assigned shifts are invalid or belong to another organization.');
      }

      // 3. Deactivate any existing rotations for this employee to prevent overlap conflict
      await ShiftRotation.updateMany(
        { employeeId: empId, organizationId: orgId, isActive: true },
        { isActive: false },
        { session }
      );

      // 4. Create new rotation
      const [rotation] = await ShiftRotation.create(
        [
          {
            organizationId: orgId,
            employeeId: empId,
            shifts: objectShiftIds,
            rotationCycleWeeks,
            startDate: parsedStart,
            isActive: true,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return rotation;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Resolves the active Shift configuration for a specific employee on a given date.
   */
  static async getAssignedShiftForDate(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    date: Date
  ): Promise<IShift | null> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId.toString());

    // Find the active rotation assignment
    const rotation = await ShiftRotation.findOne({
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
      return rotation.shifts[0] as unknown as IShift;
    }

    const cycleWeeks = rotation.rotationCycleWeeks || 1;
    const weekDiff = Math.floor(dayDiff / 7);
    const index = Math.floor(weekDiff / cycleWeeks) % rotation.shifts.length;

    const resolvedShift = rotation.shifts[index] as unknown as IShift;
    
    // Check if the weekday is part of the shift's workingDays
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayOfWeek = date.getDay();
    if (resolvedShift && resolvedShift.workingDays.includes(dayOfWeek)) {
      return resolvedShift;
    }

    return null; // Return null if it is a non-working day for this shift
  }
}
