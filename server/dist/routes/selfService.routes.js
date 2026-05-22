"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbacGuard_js_1 = require("../middlewares/rbacGuard.js");
const selfService_controller_js_1 = require("../controllers/selfService.controller.js");
const router = (0, express_1.Router)();
// Reimbursements
router.get('/reimbursements', auth_middleware_js_1.authenticate, selfService_controller_js_1.getReimbursements);
router.post('/reimbursements', auth_middleware_js_1.authenticate, selfService_controller_js_1.createReimbursement);
router.post('/reimbursements/scan', auth_middleware_js_1.authenticate, selfService_controller_js_1.scanReceipt);
router.put('/reimbursements/:id/approve', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('REIMBURSEMENTS', 'approve'), selfService_controller_js_1.approveReimbursement);
// Tax Declarations
router.get('/tax-declarations', auth_middleware_js_1.authenticate, selfService_controller_js_1.getTaxDeclarations);
router.post('/tax-declarations', auth_middleware_js_1.authenticate, selfService_controller_js_1.createTaxDeclaration);
router.put('/tax-declarations/:id/approve', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('TAX_DECLARATIONS', 'approve'), selfService_controller_js_1.approveTaxDeclaration);
// Attendance Corrections
router.get('/attendance-corrections', auth_middleware_js_1.authenticate, selfService_controller_js_1.getAttendanceCorrections);
router.post('/attendance-corrections', auth_middleware_js_1.authenticate, selfService_controller_js_1.createAttendanceCorrection);
router.put('/attendance-corrections/:id/approve', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('ATTENDANCE', 'approve'), selfService_controller_js_1.approveAttendanceCorrection);
exports.default = router;
