"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_js_1 = require("./chat.controller.js");
const router = (0, express_1.Router)();
router.get('/:otherUserId', chat_controller_js_1.getConversation);
router.post('/', chat_controller_js_1.sendMessage);
exports.default = router;
