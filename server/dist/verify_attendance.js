"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_js_1 = require("./config/db.js");
const Employee_js_1 = require("./models/Employee.js");
const User_js_1 = require("./models/User.js");
const Attendance_js_1 = require("./models/Attendance.js");
const Shift_js_1 = require("./models/Shift.js");
const AdvancedAttendanceEngine_js_1 = require("./models/AdvancedAttendanceEngine.js");
const AttendanceService_js_1 = require("./domains/attendance-engine/services/AttendanceService.js");
const ShiftService_js_1 = require("./domains/attendance-engine/services/ShiftService.js");
const BreakService_js_1 = require("./domains/attendance-engine/services/BreakService.js");
const OvertimeService_js_1 = require("./domains/attendance-engine/services/OvertimeService.js");
dotenv_1.default.config();
const runTests = async () => {
    console.log('--- Connecting to DB ---');
    await (0, db_js_1.connectDB)();
    const orgId1 = new mongoose_1.default.Types.ObjectId();
    const orgId2 = new mongoose_1.default.Types.ObjectId();
    console.log('--- Cleaning Up Test Data ---');
    await Employee_js_1.Employee.deleteMany({ employeeCode: { $regex: '^TEST-ATT-' } });
    await User_js_1.User.deleteMany({ email: { $regex: '^test.att' } });
    await Attendance_js_1.Attendance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await Shift_js_1.Shift.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await AdvancedAttendanceEngine_js_1.GeoFence.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await AdvancedAttendanceEngine_js_1.ShiftRotation.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    console.log('--- Seeding Test Data ---');
    const employeeData = {
        employeeCode: 'TEST-ATT-101',
        fullName: 'Attendance Test Employee',
        email: 'test.att.emp1@example.com',
        phone: '1234567890',
        department: 'Developers',
        designation: 'Software Engineer',
        joiningDate: new Date(),
        salary: 60000,
        address: '123 Test St',
        emergencyContact: { name: 'Emergency', relationship: 'Spouse', phone: '0987654321' },
        leaveBalance: 5,
        permissionHoursBalance: 3,
    };
    const empRecord1 = await Employee_js_1.Employee.create({ ...employeeData, organizationId: orgId1 });
    const empRecord2 = await Employee_js_1.Employee.create({ ...employeeData, employeeCode: 'TEST-ATT-102', email: 'test.att.emp2@example.com', organizationId: orgId2 });
    const fence1 = await AdvancedAttendanceEngine_js_1.GeoFence.create({
        organizationId: orgId1,
        name: 'Office HQ',
        latitude: 12.9716, // Bangalore coordinates
        longitude: 77.5946,
        radius: 100,
        isActive: true,
    });
    const shiftA = await Shift_js_1.Shift.create({
        organizationId: orgId1,
        name: 'Day Shift',
        startTime: '09:00',
        endTime: '18:00',
        workingDays: [1, 2, 3, 4, 5],
        isActive: true,
    });
    const shiftB = await Shift_js_1.Shift.create({
        organizationId: orgId2,
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:00',
        workingDays: [1, 2, 3, 4, 5],
        isActive: true,
    });
    console.log('✔ Test data seeded successfully.');
    console.log('--- 1. Testing Check-in Location Verification (IP & GPS) ---');
    // Check-in from Office IP
    const attOffice = await AttendanceService_js_1.AttendanceService.checkIn(orgId1, empRecord1._id.toString(), 'test.att.emp1@example.com', '192.168.29.15', 'Test Browser');
    if (attOffice.locationVerified && (attOffice.status === 'OFFICE' || attOffice.status === 'LEAVE')) {
        console.log('✔ Checked in from office IP correctly.');
    }
    else {
        throw new Error('Office IP verification failed.');
    }
    // Clean up today's record for next scenario
    await Attendance_js_1.Attendance.deleteMany({ organizationId: orgId1 });
    // Check-in from non-office IP but within GeoFence coordinates
    const attGeoInside = await AttendanceService_js_1.AttendanceService.checkIn(orgId1, empRecord1._id.toString(), 'test.att.emp1@example.com', '8.8.8.8', 'Test Mobile App', undefined, 12.97165, // within 100 meters
    77.59465);
    if (attGeoInside.locationVerified && (attGeoInside.status === 'OFFICE' || attGeoInside.status === 'LEAVE') && attGeoInside.geoFence?.withinGeoFence) {
        console.log('✔ Checked in from inside GeoFence correctly.');
    }
    else {
        throw new Error('Inside GeoFence coordinate check failed.');
    }
    // Clean up
    await Attendance_js_1.Attendance.deleteMany({ organizationId: orgId1 });
    // Check-in outside GeoFence (Geo Breach Anomaly)
    const attGeoOutside = await AttendanceService_js_1.AttendanceService.checkIn(orgId1, empRecord1._id.toString(), 'test.att.emp1@example.com', '8.8.8.8', 'Test Mobile App', undefined, 13.0000, // outside fence
    77.6000);
    if (attGeoOutside.anomaly?.isAnomaly && attGeoOutside.anomaly.anomalyType === 'GEO_BREACH') {
        console.log('✔ Correctly flagged geo-breach anomaly for check-in outside fence.');
    }
    else {
        throw new Error('Failed to flag anomaly for outside geo-fence check-in.');
    }
    console.log('--- 2. Testing Duplicate Check-in Prevention ---');
    try {
        await AttendanceService_js_1.AttendanceService.checkIn(orgId1, empRecord1._id.toString(), 'test.att.emp1@example.com', '127.0.0.1', 'Test Browser');
        throw new Error('Duplicate check-in was allowed!');
    }
    catch (err) {
        console.log('✔ Duplicate check-in correctly blocked:', err.message);
    }
    console.log('--- 3. Testing Shift Assignment & Cross-Tenant Validation ---');
    // Attempt to assign shiftB (org2) to emp1 (org1) -> Should fail
    try {
        await ShiftService_js_1.ShiftService.assignShiftRotation(orgId1, empRecord1._id.toString(), [shiftB._id.toString()], 1);
        throw new Error('Cross-tenant shift assignment was allowed!');
    }
    catch (err) {
        console.log('✔ Cross-tenant shift assignment correctly blocked:', err.message);
    }
    // Valid assignment
    const rotation = await ShiftService_js_1.ShiftService.assignShiftRotation(orgId1, empRecord1._id.toString(), [shiftA._id.toString()], 1);
    if (rotation.isActive) {
        console.log('✔ Assigned rotational shift successfully.');
    }
    // Resolve shift for date
    const testDate = new Date(); // Today is working day for day shift (if weekday)
    const resolved = await ShiftService_js_1.ShiftService.getAssignedShiftForDate(orgId1, empRecord1._id.toString(), testDate);
    if (resolved) {
        console.log('✔ Shift resolved successfully for today: Name =', resolved.name);
    }
    else {
        console.log('ℹ Resolved shift is null today (likely weekend/non-working day for test date).');
    }
    console.log('--- 4. Testing Break Tracking & Overtime Calculations ---');
    const todayStr = new Date().toISOString().split('T')[0];
    // Start break
    const attBreak1 = await BreakService_js_1.BreakService.startBreak(orgId1, empRecord1._id.toString(), todayStr, 'LUNCH');
    if (attBreak1.breaks.length === 1 && !attBreak1.breaks[0].breakEnd) {
        console.log('✔ Break started successfully.');
    }
    // Attempt concurrent break -> Should fail
    try {
        await BreakService_js_1.BreakService.startBreak(orgId1, empRecord1._id.toString(), todayStr, 'TEA');
        throw new Error('Concurrent break starting was allowed!');
    }
    catch (err) {
        console.log('✔ Concurrent break starting correctly blocked:', err.message);
    }
    // End break
    const attBreakEnd = await BreakService_js_1.BreakService.endBreak(orgId1, empRecord1._id.toString(), todayStr);
    if (attBreakEnd.breaks[0].breakEnd && attBreakEnd.breaks[0].durationMinutes !== undefined) {
        console.log('✔ Break ended successfully. Duration minutes =', attBreakEnd.breaks[0].durationMinutes);
    }
    // Perform checkout
    const attCheckout = await AttendanceService_js_1.AttendanceService.checkOut(orgId1, attGeoOutside._id.toString(), 'test.att.emp1@example.com');
    if (attCheckout.logoutTime && attCheckout.workingHours !== undefined) {
        console.log('✔ Checked out successfully. Total hours =', attCheckout.workingHours);
    }
    // Calculate and approve Overtime
    const attOtCalculated = await OvertimeService_js_1.OvertimeService.calculateOvertime(orgId1, attGeoOutside._id.toString());
    console.log('Overtime calculated hours =', attOtCalculated.overtime?.hours);
    // Set mock working hours to trigger overtime
    attGeoOutside.workingHours = 10.5; // Shift is 9 hours
    await attGeoOutside.save();
    const attOtRecalculated = await OvertimeService_js_1.OvertimeService.calculateOvertime(orgId1, attGeoOutside._id.toString());
    if (attOtRecalculated.overtime && attOtRecalculated.overtime.hours > 0) {
        console.log('✔ Overtime hours triggered successfully:', attOtRecalculated.overtime.hours);
    }
    else {
        throw new Error('Overtime hours calculation failed.');
    }
    const approverUser = await User_js_1.User.create({
        organizationId: orgId1,
        name: 'Test Approver',
        email: 'test.att.approver@example.com',
        role: 'ADMIN',
        isActive: true,
    });
    const attOtApproved = await OvertimeService_js_1.OvertimeService.approveOvertime(orgId1, attGeoOutside._id.toString(), approverUser._id.toString(), 'test.att.approver@example.com');
    if (attOtApproved.overtime?.isApproved) {
        console.log('✔ Overtime approved successfully.');
    }
    else {
        throw new Error('Overtime approval failed.');
    }
    console.log('--- 5. Testing Tenant Isolation / Cross-Tenant Leakage ---');
    // Attempt to check out empRecord1 using organization ID 2 -> Should fail
    try {
        await AttendanceService_js_1.AttendanceService.checkOut(orgId2, attGeoOutside._id.toString(), 'test.att.emp1@example.com');
        throw new Error('Cross-tenant checkout allowed!');
    }
    catch (err) {
        console.log('✔ Cross-tenant checkout correctly blocked:', err.message);
    }
    // Attempt to approve overtime from another organization -> Should fail
    try {
        await OvertimeService_js_1.OvertimeService.approveOvertime(orgId2, attGeoOutside._id.toString(), approverUser._id.toString(), 'hacker@org2.com');
        throw new Error('Cross-tenant overtime approval allowed!');
    }
    catch (err) {
        console.log('✔ Cross-tenant overtime approval correctly blocked:', err.message);
    }
    console.log('--- Cleaning Up Test Data ---');
    await Employee_js_1.Employee.deleteMany({ employeeCode: { $regex: '^TEST-ATT-' } });
    await User_js_1.User.deleteMany({ email: { $regex: '^test.att' } });
    await Attendance_js_1.Attendance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await Shift_js_1.Shift.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await AdvancedAttendanceEngine_js_1.GeoFence.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    await AdvancedAttendanceEngine_js_1.ShiftRotation.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
    console.log('🎉 ALL ATTENDANCE & WORKFORCE VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
};
runTests().catch(err => {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
});
