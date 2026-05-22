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
exports.SessionPolicy = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const sessionPolicySchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    maxConcurrentSessions: { type: Number, default: 5 },
    sessionTimeoutMinutes: { type: Number, default: 480 }, // 8 hours
    idleTimeoutMinutes: { type: Number, default: 30 },
    forceReauthIntervalHours: { type: Number, default: 24 },
    ipWhitelist: [{ type: String }],
    ipBlacklist: [{ type: String }],
    enforceIpRestriction: { type: Boolean, default: false },
    requireTrustedDevice: { type: Boolean, default: false },
    maxDevicesPerUser: { type: Number, default: 10 },
    requireMFA: { type: Boolean, default: false },
    mfaGracePeriodDays: { type: Number, default: 7 },
    passwordMinLength: { type: Number, default: 8 },
    passwordRequireUppercase: { type: Boolean, default: true },
    passwordRequireNumber: { type: Boolean, default: true },
    passwordRequireSpecial: { type: Boolean, default: true },
    passwordExpiryDays: { type: Number, default: 90 },
    passwordHistoryCount: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
sessionPolicySchema.index({ organizationId: 1, isDefault: 1 });
exports.SessionPolicy = mongoose_1.default.model('SessionPolicy', sessionPolicySchema);
