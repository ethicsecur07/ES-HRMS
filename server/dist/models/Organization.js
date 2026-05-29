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
exports.Organization = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const organizationSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    domain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    sector: {
        type: String,
        enum: ['IT', 'Startups', 'Manufacturing', 'Hospitals', 'Schools', 'Logistics', 'Agencies', 'Enterprises'],
        required: true,
    },
    isActive: { type: Boolean, default: true },
    settings: {
        theme: { type: String, default: 'dark' },
        logoUrl: { type: String },
        fiscalYearStart: { type: String, default: '04-01' },
        timezone: { type: String, default: 'UTC' },
        locale: { type: String, default: 'en-US' },
        currency: { type: String, default: 'USD' },
        activeWorkdays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        customHolidays: [
            {
                date: { type: String, required: true },
                name: { type: String, required: true }
            }
        ],
        monthlyLeaveLimit: { type: Number, default: 2 },
        monthlyWFHLimit: { type: Number, default: 1 },
        monthlyPermissionHours: { type: Number, default: 3 },
        salaryCycleStartDay: { type: Number, default: 1, min: 1, max: 31 },
        allowedIPs: { type: [String], default: ['127.0.0.1', '::1'] },
        adminEmail: { type: String },
        loginApprovalRoles: { type: [String], default: ['ADMIN'] },
    },
}, { timestamps: true });
exports.Organization = mongoose_1.default.model('Organization', organizationSchema);
