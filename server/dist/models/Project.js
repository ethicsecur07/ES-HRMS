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
exports.Project = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const projectSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    clientName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    budget: { type: Number, required: true, default: 0 },
    budgetStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    allocatedManagerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    teamMemberIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Employee' }],
    status: {
        type: String,
        enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'],
        default: 'PLANNING',
    },
    milestones: [
        {
            name: { type: String, required: true },
            dueDate: { type: String, required: true },
            status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
        },
    ],
    projectType: {
        type: String,
        default: 'General',
    },
    projectCategory: {
        type: String,
        enum: ['GENERAL', 'AMC'],
        default: 'GENERAL',
    },
    amcDuration: {
        type: String,
        default: '',
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
    },
    teamLeadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }],
}, { timestamps: true });
projectSchema.index({ organizationId: 1, name: 1 }, { unique: true });
exports.Project = mongoose_1.default.model('Project', projectSchema);
