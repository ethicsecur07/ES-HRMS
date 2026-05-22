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
exports.ShiftRotation = exports.GeoFence = exports.BiometricDevice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const biometricDeviceSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    ipAddress: { type: String, required: true },
    port: { type: Number, required: true, default: 4370 },
    secretKey: { type: String },
    status: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    isActive: { type: Boolean, default: true },
    lastPingAt: { type: Date },
}, { timestamps: true });
biometricDeviceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
biometricDeviceSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.BiometricDevice = mongoose_1.default.model('BiometricDevice', biometricDeviceSchema);
const geoFenceSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, required: true, default: 100 }, // default 100 meters
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
geoFenceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
geoFenceSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.GeoFence = mongoose_1.default.model('GeoFence', geoFenceSchema);
const shiftRotationSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shifts: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Shift', required: true }],
    rotationCycleWeeks: { type: Number, required: true, default: 1 },
    startDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
shiftRotationSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.ShiftRotation = mongoose_1.default.model('ShiftRotation', shiftRotationSchema);
