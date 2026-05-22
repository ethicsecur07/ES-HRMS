"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const leavePolicy_controller_js_1 = require("../controllers/leavePolicy.controller.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
// All authenticated users can view policies
router.get('/', leavePolicy_controller_js_1.getAllPolicies);
// Admin only for creating, updating, toggling
router.post('/', (0, auth_middleware_js_1.authorize)(['ADMIN']), leavePolicy_controller_js_1.createPolicy);
router.put('/:id', (0, auth_middleware_js_1.authorize)(['ADMIN']), leavePolicy_controller_js_1.updatePolicy);
router.patch('/:id/toggle', (0, auth_middleware_js_1.authorize)(['ADMIN']), leavePolicy_controller_js_1.togglePolicyStatus);
exports.default = router;
