"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payroll = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const payrollSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, index: true },
    ctcAnnual: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    baseSalary: { type: Number, required: true },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    reimbursements: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    leaveDeductions: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    finalSalary: { type: Number, required: true },
    paidStatus: { type: String, enum: ['PAID', 'PENDING', 'PROCESSING'], default: 'PENDING' },
    paymentDate: { type: Date },
    payslipUrl: { type: String },
}, { timestamps: true });
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
payrollSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.Payroll = mongoose_1.default.model('Payroll', payrollSchema);
