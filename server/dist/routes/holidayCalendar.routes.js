"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbacGuard_js_1 = require("../middlewares/rbacGuard.js");
const holidayCalendar_controller_js_1 = require("../controllers/holidayCalendar.controller.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
// All authenticated users can view holidays
router.get('/', holidayCalendar_controller_js_1.getHolidays);
// RBAC authorized endpoints for managing holidays
router.get('/google', (0, rbacGuard_js_1.rbacGuard)('LEAVE_POLICY', 'create'), holidayCalendar_controller_js_1.getGoogleHolidays);
router.post('/', (0, rbacGuard_js_1.rbacGuard)('LEAVE_POLICY', 'create'), holidayCalendar_controller_js_1.createHoliday);
router.put('/:id', (0, rbacGuard_js_1.rbacGuard)('LEAVE_POLICY', 'edit'), holidayCalendar_controller_js_1.updateHoliday);
router.delete('/:id', (0, rbacGuard_js_1.rbacGuard)('LEAVE_POLICY', 'delete'), holidayCalendar_controller_js_1.deleteHoliday);
exports.default = router;
