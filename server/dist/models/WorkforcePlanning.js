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
exports.AttritionPrediction = exports.VacancyPlanning = exports.ManpowerForecast = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const softDeletePlugin_js_1 = require("../utils/softDeletePlugin.js");
const manpowerForecastSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    currentHeadcount: { type: Number, required: true, default: 0 },
    targetHeadcount: { type: Number, required: true },
    estimatedBudget: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
manpowerForecastSchema.index({ organizationId: 1, department: 1, year: 1, quarter: 1 }, { unique: true });
manpowerForecastSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.ManpowerForecast = mongoose_1.default.model('ManpowerForecast', manpowerForecastSchema);
const vacancyPlanningSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'OPEN', 'FILLED', 'CANCELLED'], default: 'OPEN' },
    budgetAmount: { type: Number, required: true },
    targetDate: { type: Date, required: true },
    hiredEmployeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
vacancyPlanningSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.VacancyPlanning = mongoose_1.default.model('VacancyPlanning', vacancyPlanningSchema);
const attritionPredictionSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    attritionRiskScore: { type: Number, required: true, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    factors: [{ type: String }],
    lastEvaluated: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
attritionPredictionSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
attritionPredictionSchema.plugin(softDeletePlugin_js_1.softDeletePlugin);
exports.AttritionPrediction = mongoose_1.default.model('AttritionPrediction', attritionPredictionSchema);
