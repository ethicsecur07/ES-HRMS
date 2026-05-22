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
exports.ReportingHierarchy = exports.CostCenter = exports.BusinessUnit = exports.Division = exports.Branch = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const branchSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    location: { type: String, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
branchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
branchSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.Branch = mongoose_1.default.model('Branch', branchSchema);
const divisionSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
divisionSchema.index({ organizationId: 1, code: 1 }, { unique: true });
divisionSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.Division = mongoose_1.default.model('Division', divisionSchema);
const businessUnitSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    divisionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Division' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
businessUnitSchema.index({ organizationId: 1, code: 1 }, { unique: true });
businessUnitSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.BusinessUnit = mongoose_1.default.model('BusinessUnit', businessUnitSchema);
const costCenterSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
costCenterSchema.index({ organizationId: 1, code: 1 }, { unique: true });
costCenterSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.CostCenter = mongoose_1.default.model('CostCenter', costCenterSchema);
const reportingHierarchySchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    primaryManagerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' },
    matrixManagers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' }],
    hrBPId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });
reportingHierarchySchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
reportingHierarchySchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.ReportingHierarchy = mongoose_1.default.model('ReportingHierarchy', reportingHierarchySchema);
