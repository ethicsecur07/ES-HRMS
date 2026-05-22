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
exports.LeavePolicy = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const leavePolicySchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    leaveType: {
        type: String,
        enum: ['Casual Leave', 'Sick Leave', 'WFH', 'Permission', 'Compensatory Off', 'Unpaid Leave'],
        required: true,
    },
    monthlyAllowance: { type: Number, required: true },
    carryForward: { type: Boolean, default: false },
    carryForwardLimit: { type: Number, default: 0 },
    sandwichLeaveRule: { type: Boolean, default: false },
    holidayOverlapRule: { type: Boolean, default: true },
    compensatoryOffEligibility: {
        canEarn: { type: Boolean, default: false },
        validityDays: { type: Number, default: 60 }
    },
    encashmentRule: {
        canEncash: { type: Boolean, default: false },
        maxEncashableDays: { type: Number, default: 10 },
        encashmentRatePercentage: { type: Number, default: 100 }
    },
    latePenaltyCount: { type: Number, default: 3 },
    permissionConversionHours: { type: Number, default: 3 },
    halfDayEnabled: { type: Boolean, default: false },
    advanceNoticeDays: { type: Number, default: 0 },
    maxConsecutiveDays: { type: Number, default: 0 },
    applicableGender: { type: String, enum: ['All', 'Male', 'Female'], default: 'All' },
    probationExempt: { type: Boolean, default: false },
    permissionAutoConvert: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
leavePolicySchema.index({ organizationId: 1, leaveType: 1 }, { unique: true });
exports.LeavePolicy = mongoose_1.default.model('LeavePolicy', leavePolicySchema);
