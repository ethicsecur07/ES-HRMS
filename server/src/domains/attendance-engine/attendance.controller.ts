import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { BiometricDevice, GeoFence, ShiftRotation } from '../../models/AdvancedAttendanceEngine.js';
import { Shift } from '../../models/Shift.js';
import { Attendance } from '../../models/Attendance.js';
import { Employee } from '../../models/Employee.js';
import { AttendanceService } from './services/AttendanceService.js';
import { ShiftService } from './services/ShiftService.js';
import { BreakService } from './services/BreakService.js';
import { OvertimeService } from './services/OvertimeService.js';

export const getAttendanceSettings = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const devices = await BiometricDevice.find({ organizationId: orgId });
    const fences = await GeoFence.find({ organizationId: orgId });
    const rotations = await ShiftRotation.find({ organizationId: orgId });
    const shifts = await Shift.find({ organizationId: orgId });

    res.json({ devices, fences, rotations, shifts });
  } catch (err) {
    next(err);
  }
};

// --- GEOFENCING CRUDS & CHECKINS ---
export const createGeoFence = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const fence = new GeoFence({ ...req.body, organizationId: orgId });
    await fence.save();
    res.status(201).json(fence);
  } catch (err) {
    next(err);
  }
};

export const updateGeoFence = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const fence = await GeoFence.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      req.body,
      { new: true }
    );
    if (!fence) {
      res.status(404).json({ message: 'GeoFence not found or unauthorized' });
      return;
    }
    res.json(fence);
  } catch (err) {
    next(err);
  }
};

export const deleteGeoFence = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const fence = await GeoFence.findOne({ _id: req.params.id, organizationId: orgId });
    if (!fence) {
      res.status(404).json({ message: 'GeoFence not found or unauthorized' });
      return;
    }
    if (typeof (fence as any).softDelete === 'function') {
      await (fence as any).softDelete();
    } else {
      await fence.deleteOne();
    }
    res.json({ message: 'GeoFence soft-deleted' });
  } catch (err) {
    next(err);
  }
};

export const validateCheckInLocation = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { lat, lng } = req.body;

    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const inRange = await AttendanceService.getTodayAttendance(orgId); // placeholder or fetch fence
    const fences = await GeoFence.find({ organizationId: orgId, isActive: true });

    let matchedFence = null;
    let computedDistance = Infinity;
    let isInside = false;

    // Direct mathematical distance calculation helper
    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const dPhi = ((lat2 - lat1) * Math.PI) / 180;
      const dLam = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam/2) * Math.sin(dLam/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    for (const fence of fences) {
      const distance = getDist(lat, lng, fence.latitude, fence.longitude);
      if (distance <= fence.radius) {
        isInside = true;
        matchedFence = fence;
        computedDistance = distance;
        break;
      }
    }

    res.json({
      inRange: isInside,
      distance: computedDistance === Infinity ? null : Math.round(computedDistance),
      fenceName: matchedFence ? matchedFence.name : null,
    });
  } catch (err) {
    next(err);
  }
};

// --- BIOMETRIC DEVICE ENDPOINTS ---
export const createBiometricDevice = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const device = new BiometricDevice({ ...req.body, organizationId: orgId });
    await device.save();
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
};

export const simulateBiometricPing = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }
    const { deviceId, cardNo, direction } = req.body;

    const device = await BiometricDevice.findOne({ deviceId, organizationId: orgId, isActive: true });
    if (!device) {
      res.status(404).json({ message: 'Active biometric device not registered' });
      return;
    }

    device.lastPingAt = new Date();
    await device.save();

    // Map biometric cardNo to employee
    const employee = await Employee.findOne({ employeeCode: cardNo, organizationId: orgId });
    if (employee) {
      if (direction === 'IN') {
        await AttendanceService.checkIn(
          orgId,
          employee._id.toString(),
          'biometric-system@antigravity.erp',
          device.ipAddress,
          'Biometric Fingerprint Reader'
        );
      } else {
        const today = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.findOne({ employeeId: employee._id, date: today, organizationId: orgId });
        if (attendance) {
          await AttendanceService.checkOut(
            orgId,
            attendance._id.toString(),
            'biometric-system@antigravity.erp'
          );
        }
      }
    }

    res.json({
      success: true,
      message: `Biometric authentication check-in: ${direction} processed successfully for Card ${cardNo}`,
      timestamp: new Date(),
    });
  } catch (err) {
    next(err);
  }
};

// --- SHIFTS MANAGEMENT ---
export const createShift = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }
    const shift = await ShiftService.createShift(orgId, req.body);
    res.status(201).json(shift);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const updateShift = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }
    const shift = await ShiftService.updateShift(orgId, req.params.id, req.body);
    res.json(shift);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteShift = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }
    await ShiftService.deleteShift(orgId, req.params.id);
    res.json({ message: 'Shift deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const assignShiftRotation = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }
    const { employeeId, shifts, rotationCycleWeeks, startDate } = req.body;
    const rotation = await ShiftService.assignShiftRotation(orgId, employeeId, shifts, rotationCycleWeeks, startDate);
    res.status(201).json(rotation);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// --- BREAK TRACKING ---
export const startBreak = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const employeeId = (req.user as any)?.employeeId;
    if (!orgId || !employeeId) {
      res.status(400).json({ message: 'Employee ID and Organization ID are required' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const attendance = await BreakService.startBreak(orgId, employeeId, today, req.body.type);
    res.status(200).json({ data: attendance });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const endBreak = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const employeeId = (req.user as any)?.employeeId;
    if (!orgId || !employeeId) {
      res.status(400).json({ message: 'Employee ID and Organization ID are required' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const attendance = await BreakService.endBreak(orgId, employeeId, today);
    res.status(200).json({ data: attendance });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// --- OVERTIME APPROVALS ---
export const approveOvertime = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const email = req.user?.email;
    if (!orgId || !userId || !email) {
      res.status(400).json({ message: 'User details are required' });
      return;
    }
    // Calculate first to ensure hours match working duration vs shift duration
    await OvertimeService.calculateOvertime(orgId, req.params.id);
    const attendance = await OvertimeService.approveOvertime(orgId, req.params.id, userId, email);
    res.status(200).json({ data: attendance });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
