"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveOvertime = exports.endBreak = exports.startBreak = exports.assignShiftRotation = exports.deleteShift = exports.updateShift = exports.createShift = exports.simulateBiometricPing = exports.createBiometricDevice = exports.validateCheckInLocation = exports.deleteGeoFence = exports.updateGeoFence = exports.createGeoFence = exports.getAttendanceSettings = void 0;
const AdvancedAttendanceEngine_js_1 = require("../../models/AdvancedAttendanceEngine.js");
const Shift_js_1 = require("../../models/Shift.js");
const Attendance_js_1 = require("../../models/Attendance.js");
const Employee_js_1 = require("../../models/Employee.js");
const AttendanceService_js_1 = require("./services/AttendanceService.js");
const ShiftService_js_1 = require("./services/ShiftService.js");
const BreakService_js_1 = require("./services/BreakService.js");
const OvertimeService_js_1 = require("./services/OvertimeService.js");
const getAttendanceSettings = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const devices = await AdvancedAttendanceEngine_js_1.BiometricDevice.find({ organizationId: orgId });
        const fences = await AdvancedAttendanceEngine_js_1.GeoFence.find({ organizationId: orgId });
        const rotations = await AdvancedAttendanceEngine_js_1.ShiftRotation.find({ organizationId: orgId });
        const shifts = await Shift_js_1.Shift.find({ organizationId: orgId });
        res.json({ devices, fences, rotations, shifts });
    }
    catch (err) {
        next(err);
    }
};
exports.getAttendanceSettings = getAttendanceSettings;
// --- GEOFENCING CRUDS & CHECKINS ---
const createGeoFence = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const fence = new AdvancedAttendanceEngine_js_1.GeoFence({ ...req.body, organizationId: orgId });
        await fence.save();
        res.status(201).json(fence);
    }
    catch (err) {
        next(err);
    }
};
exports.createGeoFence = createGeoFence;
const updateGeoFence = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const fence = await AdvancedAttendanceEngine_js_1.GeoFence.findOneAndUpdate({ _id: req.params.id, organizationId: orgId }, req.body, { new: true });
        if (!fence) {
            res.status(404).json({ message: 'GeoFence not found or unauthorized' });
            return;
        }
        res.json(fence);
    }
    catch (err) {
        next(err);
    }
};
exports.updateGeoFence = updateGeoFence;
const deleteGeoFence = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const fence = await AdvancedAttendanceEngine_js_1.GeoFence.findOne({ _id: req.params.id, organizationId: orgId });
        if (!fence) {
            res.status(404).json({ message: 'GeoFence not found or unauthorized' });
            return;
        }
        if (typeof fence.softDelete === 'function') {
            await fence.softDelete();
        }
        else {
            await fence.deleteOne();
        }
        res.json({ message: 'GeoFence soft-deleted' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteGeoFence = deleteGeoFence;
const validateCheckInLocation = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { lat, lng } = req.body;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const inRange = await AttendanceService_js_1.AttendanceService.getTodayAttendance(orgId); // placeholder or fetch fence
        const fences = await AdvancedAttendanceEngine_js_1.GeoFence.find({ organizationId: orgId, isActive: true });
        let matchedFence = null;
        let computedDistance = Infinity;
        let isInside = false;
        // Direct mathematical distance calculation helper
        const getDist = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3;
            const phi1 = (lat1 * Math.PI) / 180;
            const phi2 = (lat2 * Math.PI) / 180;
            const dPhi = ((lat2 - lat1) * Math.PI) / 180;
            const dLam = ((lon2 - lon1) * Math.PI) / 180;
            const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) * Math.sin(dLam / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    }
    catch (err) {
        next(err);
    }
};
exports.validateCheckInLocation = validateCheckInLocation;
// --- BIOMETRIC DEVICE ENDPOINTS ---
const createBiometricDevice = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const device = new AdvancedAttendanceEngine_js_1.BiometricDevice({ ...req.body, organizationId: orgId });
        await device.save();
        res.status(201).json(device);
    }
    catch (err) {
        next(err);
    }
};
exports.createBiometricDevice = createBiometricDevice;
const simulateBiometricPing = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const { deviceId, cardNo, direction } = req.body;
        const device = await AdvancedAttendanceEngine_js_1.BiometricDevice.findOne({ deviceId, organizationId: orgId, isActive: true });
        if (!device) {
            res.status(404).json({ message: 'Active biometric device not registered' });
            return;
        }
        device.lastPingAt = new Date();
        await device.save();
        // Map biometric cardNo to employee
        const employee = await Employee_js_1.Employee.findOne({ employeeCode: cardNo, organizationId: orgId });
        if (employee) {
            if (direction === 'IN') {
                await AttendanceService_js_1.AttendanceService.checkIn(orgId, employee._id.toString(), 'biometric-system@antigravity.erp', device.ipAddress, 'Biometric Fingerprint Reader');
            }
            else {
                const today = new Date().toISOString().split('T')[0];
                const attendance = await Attendance_js_1.Attendance.findOne({ employeeId: employee._id, date: today, organizationId: orgId });
                if (attendance) {
                    await AttendanceService_js_1.AttendanceService.checkOut(orgId, attendance._id.toString(), 'biometric-system@antigravity.erp');
                }
            }
        }
        res.json({
            success: true,
            message: `Biometric authentication check-in: ${direction} processed successfully for Card ${cardNo}`,
            timestamp: new Date(),
        });
    }
    catch (err) {
        next(err);
    }
};
exports.simulateBiometricPing = simulateBiometricPing;
// --- SHIFTS MANAGEMENT ---
const createShift = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const shift = await ShiftService_js_1.ShiftService.createShift(orgId, req.body);
        res.status(201).json(shift);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.createShift = createShift;
const updateShift = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const shift = await ShiftService_js_1.ShiftService.updateShift(orgId, req.params.id, req.body);
        res.json(shift);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.updateShift = updateShift;
const deleteShift = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        await ShiftService_js_1.ShiftService.deleteShift(orgId, req.params.id);
        res.json({ message: 'Shift deleted successfully' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.deleteShift = deleteShift;
const assignShiftRotation = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const { employeeId, shifts, rotationCycleWeeks, startDate } = req.body;
        const rotation = await ShiftService_js_1.ShiftService.assignShiftRotation(orgId, employeeId, shifts, rotationCycleWeeks, startDate);
        res.status(201).json(rotation);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.assignShiftRotation = assignShiftRotation;
// --- BREAK TRACKING ---
const startBreak = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const employeeId = req.user?.employeeId;
        if (!orgId || !employeeId) {
            res.status(400).json({ message: 'Employee ID and Organization ID are required' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const attendance = await BreakService_js_1.BreakService.startBreak(orgId, employeeId, today, req.body.type);
        res.status(200).json({ data: attendance });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.startBreak = startBreak;
const endBreak = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const employeeId = req.user?.employeeId;
        if (!orgId || !employeeId) {
            res.status(400).json({ message: 'Employee ID and Organization ID are required' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const attendance = await BreakService_js_1.BreakService.endBreak(orgId, employeeId, today);
        res.status(200).json({ data: attendance });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.endBreak = endBreak;
// --- OVERTIME APPROVALS ---
const approveOvertime = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!orgId || !userId || !email) {
            res.status(400).json({ message: 'User details are required' });
            return;
        }
        // Calculate first to ensure hours match working duration vs shift duration
        await OvertimeService_js_1.OvertimeService.calculateOvertime(orgId, req.params.id);
        const attendance = await OvertimeService_js_1.OvertimeService.approveOvertime(orgId, req.params.id, userId, email);
        res.status(200).json({ data: attendance });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.approveOvertime = approveOvertime;
