"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const moduleGuard_js_1 = require("../../middlewares/moduleGuard.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const validate_middleware_js_1 = require("../../middlewares/validate.middleware.js");
const attendance_controller_js_1 = require("./attendance.controller.js");
const attendance_validation_js_1 = require("./validations/attendance.validation.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
router.use((0, moduleGuard_js_1.moduleGuard)(['ADVANCED_ATTENDANCE']));
// Configuration retrieval
router.get('/settings', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'view'), attendance_controller_js_1.getAttendanceSettings);
// Geofence management
router.post('/geofence', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.createGeoFenceSchema), attendance_controller_js_1.createGeoFence);
router.put('/geofence/:id', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'edit'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.updateGeoFenceSchema), attendance_controller_js_1.updateGeoFence);
router.delete('/geofence/:id', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'delete'), attendance_controller_js_1.deleteGeoFence);
// GPS location coordinate geofence check
router.post('/validate-location', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'view'), attendance_controller_js_1.validateCheckInLocation);
// Biometric device endpoints
router.post('/device', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.createBiometricDeviceSchema), attendance_controller_js_1.createBiometricDevice);
router.post('/ping', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.simulateBiometricPingSchema), attendance_controller_js_1.simulateBiometricPing);
// Shift management
router.post('/shift', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.createShiftSchema), attendance_controller_js_1.createShift);
router.put('/shift/:id', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'edit'), attendance_controller_js_1.updateShift);
router.delete('/shift/:id', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'delete'), attendance_controller_js_1.deleteShift);
// Shift rotation assignment
router.post('/shift-rotation', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.assignShiftRotationSchema), attendance_controller_js_1.assignShiftRotation);
// Breaks
router.post('/break/start', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.startBreakSchema), attendance_controller_js_1.startBreak);
router.post('/break/end', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'create'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.endBreakSchema), attendance_controller_js_1.endBreak);
// Overtime
router.post('/overtime/approve/:id', (0, rbacGuard_js_1.rbacGuard)('ADVANCED_ATTENDANCE', 'approve'), (0, validate_middleware_js_1.validateRequest)(attendance_validation_js_1.approveOvertimeSchema), attendance_controller_js_1.approveOvertime);
exports.default = router;
