"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meeting_controller_js_1 = require("../controllers/meeting.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Public redirect route to enforce meeting timeframe
router.get('/join/:id', meeting_controller_js_1.joinMeetingRedirect);
// All other routes require authentication
router.post('/', auth_middleware_js_1.authenticate, meeting_controller_js_1.scheduleMeeting);
router.get('/', auth_middleware_js_1.authenticate, meeting_controller_js_1.getMeetings);
router.get('/:id', auth_middleware_js_1.authenticate, meeting_controller_js_1.getMeetingById);
router.put('/:id', auth_middleware_js_1.authenticate, meeting_controller_js_1.updateMeeting);
router.delete('/:id', auth_middleware_js_1.authenticate, meeting_controller_js_1.deleteMeeting);
exports.default = router;
