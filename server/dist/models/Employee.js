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
exports.Employee = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const employeeSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeCode: { type: String, required: false },
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    profileImage: { type: String },
    salary: { type: Number, required: true },
    address: { type: String, required: true },
    emergencyContact: {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true },
    },
    leaveBalance: { type: Number, default: 2 },
    wfhBalance: { type: Number, default: 1 },
    permissionHoursBalance: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
    branchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch', index: true },
    costCenterId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CostCenter', index: true },
    primaryManagerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', index: true },
    designationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Designation', index: true },
    departmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Department', index: true },
    confirmationDate: { type: Date },
    terminationDate: { type: Date },
    customFields: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
    bankDetails: {
        bankName: { type: String, default: '' },
        accountName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        branchName: { type: String, default: '' },
    },
    taxDetails: {
        panNumber: { type: String, default: '' },
        taxRegime: { type: String, enum: ['OLD', 'NEW', ''], default: '' },
    },
}, { timestamps: true });
employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const User_js_1 = require("./User.js");
employeeSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
// Cascade Soft Delete: When an Employee is soft-deleted, their User login is revoked
employeeSchema.pre('save', async function (next) {
    if (this.isModified('isDeleted') && this.isDeleted === true) {
        const user = await User_js_1.User.findOne({ employeeId: this._id });
        if (user && typeof user.softDelete === 'function') {
            await user.softDelete();
        }
    }
    next();
});
exports.Employee = mongoose_1.default.model('Employee', employeeSchema);
