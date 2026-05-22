import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { moduleGuard } from '../../middlewares/moduleGuard.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import {
  getAttendanceSettings,
  createGeoFence,
  updateGeoFence,
  deleteGeoFence,
  validateCheckInLocation,
  createBiometricDevice,
  simulateBiometricPing,
  assignShiftRotation,
  createShift,
  updateShift,
  deleteShift,
  startBreak,
  endBreak,
  approveOvertime,
} from './attendance.controller.js';
import {
  createGeoFenceSchema,
  updateGeoFenceSchema,
  createBiometricDeviceSchema,
  simulateBiometricPingSchema,
  createShiftSchema,
  assignShiftRotationSchema,
  startBreakSchema,
  endBreakSchema,
  approveOvertimeSchema,
} from './validations/attendance.validation.js';

const router = Router();

router.use(authenticate);
router.use(moduleGuard(['ADVANCED_ATTENDANCE']));

// Configuration retrieval
router.get('/settings', rbacGuard('ADVANCED_ATTENDANCE', 'view'), getAttendanceSettings);

// Geofence management
router.post('/geofence', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(createGeoFenceSchema), createGeoFence);
router.put('/geofence/:id', rbacGuard('ADVANCED_ATTENDANCE', 'edit'), validateRequest(updateGeoFenceSchema), updateGeoFence);
router.delete('/geofence/:id', rbacGuard('ADVANCED_ATTENDANCE', 'delete'), deleteGeoFence);

// GPS location coordinate geofence check
router.post('/validate-location', rbacGuard('ADVANCED_ATTENDANCE', 'view'), validateCheckInLocation);

// Biometric device endpoints
router.post('/device', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(createBiometricDeviceSchema), createBiometricDevice);
router.post('/ping', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(simulateBiometricPingSchema), simulateBiometricPing);

// Shift management
router.post('/shift', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(createShiftSchema), createShift);
router.put('/shift/:id', rbacGuard('ADVANCED_ATTENDANCE', 'edit'), updateShift);
router.delete('/shift/:id', rbacGuard('ADVANCED_ATTENDANCE', 'delete'), deleteShift);

// Shift rotation assignment
router.post('/shift-rotation', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(assignShiftRotationSchema), assignShiftRotation);

// Breaks
router.post('/break/start', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(startBreakSchema), startBreak);
router.post('/break/end', rbacGuard('ADVANCED_ATTENDANCE', 'create'), validateRequest(endBreakSchema), endBreak);

// Overtime
router.post('/overtime/approve/:id', rbacGuard('ADVANCED_ATTENDANCE', 'approve'), validateRequest(approveOvertimeSchema), approveOvertime);

export default router;
