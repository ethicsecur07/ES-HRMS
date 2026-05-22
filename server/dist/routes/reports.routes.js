"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_js_1 = require("../controllers/reports.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Only ADMIN, HR, MANAGER can access these reports
router.use(auth_middleware_js_1.authenticate);
router.use((0, auth_middleware_js_1.authorize)(['ADMIN', 'HR', 'MANAGER']));
router.get('/attendance', reports_controller_js_1.getAttendanceReport);
router.get('/payroll', reports_controller_js_1.getPayrollReport);
router.get('/performance', reports_controller_js_1.getPerformanceReport);
router.get('/expenses', reports_controller_js_1.getExpenseReport);
router.get('/leave', reports_controller_js_1.getLeaveReport);
router.get('/projects', reports_controller_js_1.getProjectReport);
exports.default = router;
