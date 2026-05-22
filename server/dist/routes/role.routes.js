"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const role_controller_js_1 = require("../controllers/role.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Only ADMIN and HR roles can manage system roles
router.use(auth_middleware_js_1.authenticate);
router.use((0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']));
router.get('/', role_controller_js_1.getRoles);
router.get('/:id', role_controller_js_1.getRoleById);
router.post('/', role_controller_js_1.createRole);
router.put('/:id', role_controller_js_1.updateRole);
router.delete('/:id', role_controller_js_1.deleteRole);
exports.default = router;
