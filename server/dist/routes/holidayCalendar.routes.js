"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const holidayCalendar_controller_js_1 = require("../controllers/holidayCalendar.controller.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
// All authenticated users can view holidays
router.get('/', holidayCalendar_controller_js_1.getHolidays);
// Admin and HR can manage holidays
router.post('/', (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), holidayCalendar_controller_js_1.createHoliday);
router.put('/:id', (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), holidayCalendar_controller_js_1.updateHoliday);
router.delete('/:id', (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), holidayCalendar_controller_js_1.deleteHoliday);
exports.default = router;
