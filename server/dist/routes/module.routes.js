"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const module_controller_js_1 = require("../controllers/module.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
router.get('/enabled', auth_middleware_js_1.authenticate, module_controller_js_1.getEnabledModules);
router.get('/routes', auth_middleware_js_1.authenticate, module_controller_js_1.getModuleRoutes);
exports.default = router;
