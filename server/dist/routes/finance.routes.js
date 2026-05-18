"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const finance_controller_js_1 = require("../controllers/finance.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = express_1.default.Router();
router.use(auth_middleware_js_1.authenticate);
router.use((0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']));
router.get('/', finance_controller_js_1.getFinanceSummary);
router.post('/', finance_controller_js_1.addFinanceRecord);
exports.default = router;
