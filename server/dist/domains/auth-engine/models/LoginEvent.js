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
exports.LoginEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const loginEventSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', index: true },
    email: { type: String, required: true, index: true },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'BLOCKED', 'MFA_REQUIRED', 'MFA_FAILED'],
        required: true,
    },
    provider: { type: String, default: 'LOCAL' },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    deviceFingerprint: { type: String },
    location: { type: String },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    riskFactors: [{ type: String }],
    failureReason: { type: String },
    sessionId: { type: String },
    mfaMethod: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
loginEventSchema.index({ email: 1, createdAt: -1 });
loginEventSchema.index({ organizationId: 1, createdAt: -1 });
loginEventSchema.index({ ipAddress: 1, createdAt: -1 });
// TTL index: auto-delete login events older than 90 days
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.LoginEvent = mongoose_1.default.model('LoginEvent', loginEventSchema);
