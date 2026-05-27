"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payrollConfig_controller_js_1 = require("../controllers/payrollConfig.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// GET - fetch payroll config (ADMIN/HR)
router.get('/', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), payrollConfig_controller_js_1.getPayrollConfig);
// PUT - save/update payroll config (ADMIN/HR)
router.put('/', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), payrollConfig_controller_js_1.savePayrollConfig);
exports.default = router;
