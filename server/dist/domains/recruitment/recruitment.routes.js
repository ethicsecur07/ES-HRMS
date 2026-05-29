"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recruitment_controller_js_1 = require("./recruitment.controller.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Assuming 'RECRUITMENT' module code
router.post('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'create'), recruitment_controller_js_1.createCandidate);
router.get('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'view'), recruitment_controller_js_1.getCandidates);
router.get('/templates/default', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'view'), recruitment_controller_js_1.getOfferTemplate);
router.put('/templates/default', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'edit'), recruitment_controller_js_1.updateOfferTemplate);
router.put('/:id/stage', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'edit'), recruitment_controller_js_1.updateCandidateStage);
router.put('/:id', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'edit'), recruitment_controller_js_1.updateCandidate);
router.delete('/:id', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'delete'), recruitment_controller_js_1.deleteCandidate);
router.post('/:id/send-offer', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('RECRUITMENT', 'edit'), recruitment_controller_js_1.sendCandidateOffer);
exports.default = router;
