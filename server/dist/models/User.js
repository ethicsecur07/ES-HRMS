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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../constants/index.js");
const userSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    profileImage: { type: String },
    role: { type: String, enum: Object.values(index_js_1.ROLES), default: index_js_1.ROLES.EMPLOYEE },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    backupCodes: { type: [String], select: false },
    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date },
    passwordChangedAt: { type: Date, default: Date.now },
    ssoData: {
        provider: { type: String },
        azureRoles: { type: [String] },
        mappedRole: { type: String },
        lastSyncedAt: { type: Date }
    },
}, { timestamps: true });
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
// Enforce tenant isolation for users (an email can only exist once PER organization)
userSchema.index({ email: 1, organizationId: 1 }, { unique: true });
userSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.User = mongoose_1.default.model('User', userSchema);
