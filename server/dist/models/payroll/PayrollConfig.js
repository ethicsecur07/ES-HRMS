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
exports.DEFAULT_PAYROLL_CONFIG = exports.PayrollConfig = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const payrollConfigSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    // Earnings
    basicSalaryPercent: { type: Number, default: 40, min: 0, max: 100 },
    hraPercent: { type: Number, default: 40, min: 0, max: 100 },
    conveyanceMonthly: { type: Number, default: 1600, min: 0 },
    performanceIncentiveMonthly: { type: Number, default: 0, min: 0 },
    otherAllowancesMonthly: { type: Number, default: 0, min: 0 },
    // Deductions
    pfEmployeePercent: { type: Number, default: 12, min: 0, max: 100 },
    professionalTaxMonthly: { type: Number, default: 200, min: 0 },
    incomeTaxTdsMonthly: { type: Number, default: 0, min: 0 },
    // Employer Contributions
    pfEmployerPercent: { type: Number, default: 12, min: 0, max: 100 },
    gratuityPercent: { type: Number, default: 4.81, min: 0, max: 100 },
    esiEmployerPercent: { type: Number, default: 3.25, min: 0, max: 100 },
    insuranceMonthly: { type: Number, default: 0, min: 0 },
    // ESI Toggle
    applyEsiOnlyIfGrossBelow21000: { type: Boolean, default: true },
}, { timestamps: true });
payrollConfigSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
exports.PayrollConfig = mongoose_1.default.model('PayrollConfig', payrollConfigSchema);
// Default config values used when no org config exists
exports.DEFAULT_PAYROLL_CONFIG = {
    basicSalaryPercent: 40,
    hraPercent: 40,
    conveyanceMonthly: 1600,
    performanceIncentiveMonthly: 0,
    otherAllowancesMonthly: 0,
    pfEmployeePercent: 12,
    professionalTaxMonthly: 200,
    incomeTaxTdsMonthly: 0,
    pfEmployerPercent: 12,
    gratuityPercent: 4.81,
    esiEmployerPercent: 3.25,
    insuranceMonthly: 0,
    applyEsiOnlyIfGrossBelow21000: true,
};
