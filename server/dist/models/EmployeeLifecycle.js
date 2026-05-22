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
exports.EmployeeLifecycle = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const lifecycleStepSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'], default: 'PENDING' },
    assignedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    notes: { type: String }
});
const employeeLifecycleSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: {
        type: String,
        enum: ['ONBOARDING', 'PROBATION', 'PROMOTION', 'TRANSFER', 'RESIGNATION', 'EXIT'],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'INITIATED',
    },
    startDate: { type: Date, required: true, default: Date.now },
    completionDate: { type: Date },
    steps: [lifecycleStepSchema],
    probationDetails: {
        durationMonths: { type: Number },
        reviewDate: { type: Date },
        rating: { type: Number },
        isConfirmed: { type: Boolean, default: false },
    },
    promotionDetails: {
        oldRoleCode: { type: String },
        newRoleCode: { type: String },
        oldSalary: { type: Number },
        newSalary: { type: Number },
        effectiveDate: { type: Date },
    },
    transferDetails: {
        oldBranchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch' },
        newBranchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch' },
        oldDepartment: { type: String },
        newDepartment: { type: String },
        effectiveDate: { type: Date },
    },
    resignationDetails: {
        resignationDate: { type: Date },
        lastWorkingDay: { type: Date },
        reason: { type: String },
        exitInterviewCompleted: { type: Boolean, default: false },
    },
    offboardingChecklist: {
        assetsReturned: { type: Boolean, default: false },
        itAccessRevoked: { type: Boolean, default: false },
        payrollSettled: { type: Boolean, default: false },
        clearanceCertificateIssued: { type: Boolean, default: false },
    },
}, { timestamps: true });
employeeLifecycleSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.EmployeeLifecycle = mongoose_1.default.model('EmployeeLifecycle', employeeLifecycleSchema);
