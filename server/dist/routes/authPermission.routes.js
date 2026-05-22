"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authPermission_controller_js_1 = require("../controllers/authPermission.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
// Route available to any authenticated user to fetch their own compiled permissions
router.get('/my-permissions', authPermission_controller_js_1.getMyPermissions);
// Only ADMIN and HR roles can manage other permissions
router.use((0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']));
router.get('/matrix', authPermission_controller_js_1.getPermissionMatrix);
router.put('/matrix', authPermission_controller_js_1.updatePermissionMatrix);
router.get('/overrides', authPermission_controller_js_1.getUserOverrides);
router.post('/overrides', authPermission_controller_js_1.upsertUserOverride);
router.delete('/overrides', authPermission_controller_js_1.deleteUserOverride);
exports.default = router;
