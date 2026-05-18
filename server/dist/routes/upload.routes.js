"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_controller_js_1 = require("../controllers/upload.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
router.post('/', auth_middleware_js_1.authenticate, upload_controller_js_1.upload.single('image'), upload_controller_js_1.uploadImage);
exports.default = router;
