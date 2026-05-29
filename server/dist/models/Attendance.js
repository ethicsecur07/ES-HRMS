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
exports.Attendance = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../constants/index.js");
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const breakSchema = new mongoose_1.Schema({
    breakStart: { type: Date, required: true },
    breakEnd: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    type: { type: String, enum: ['LUNCH', 'TEA', 'PERSONAL'], default: 'LUNCH' }
});
const attendanceSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, index: true },
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date },
    ipAddress: { type: String, required: true },
    deviceInfo: { type: String, required: true },
    status: { type: String, enum: Object.values(index_js_1.ATTENDANCE_TYPES), default: index_js_1.ATTENDANCE_TYPES.OFFICE },
    workingHours: { type: Number },
    isLate: { type: Boolean, default: false },
    taskSubmitted: { type: Boolean, default: false },
    locationVerified: { type: Boolean, default: true },
    overrideReason: { type: String },
    isAutoCheckedOut: { type: Boolean, default: false },
    pendingReportUpdate: { type: Boolean, default: false },
    // Advanced Attendance Engine
    biometricId: { type: String },
    deviceId: { type: String },
    geoFence: {
        latitude: { type: Number },
        longitude: { type: Number },
        withinGeoFence: { type: Boolean, default: true },
        distanceFromCenter: { type: Number, default: 0 }
    },
    faceVerification: {
        verified: { type: Boolean, default: false },
        confidence: { type: Number, default: 0 },
        faceImage: { type: String }
    },
    breaks: [breakSchema],
    overtime: {
        hours: { type: Number, default: 0 },
        isApproved: { type: Boolean, default: false },
        approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
    },
    shiftId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Shift' },
    anomaly: {
        isAnomaly: { type: Boolean, default: false, index: true },
        anomalyType: { type: String, enum: ['GEO_BREACH', 'MISSING_OUT', 'UNUSUAL_HOURS', 'BREAK_EXCESS'] },
        description: { type: String },
        isResolved: { type: Boolean, default: false },
        resolvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
    },
    editHistory: [
        {
            field: { type: String, required: true },
            oldValue: { type: String, required: true },
            newValue: { type: String, required: true },
            updatedBy: { type: String, required: true },
            time: { type: Date, default: Date.now },
            ip: { type: String, required: true }
        }
    ]
}, { timestamps: true });
// Prevent duplicate attendance per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.Attendance = mongoose_1.default.model('Attendance', attendanceSchema);
