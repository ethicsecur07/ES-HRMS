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
exports.WorkflowInstance = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const approvalLogSchema = new mongoose_1.Schema({
    nodeId: { type: String, required: true },
    nodeName: { type: String, required: true },
    approverUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    approverRole: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'], default: 'PENDING' },
    actionTakenAt: { type: Date },
    comments: { type: String },
});
const workflowInstanceSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    workflowTemplateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'WorkflowTemplate', required: true, index: true },
    refModel: { type: String, required: true },
    refId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    currentNodeId: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'APPROVED', 'REJECTED', 'TERMINATED'], default: 'ACTIVE', index: true },
    history: { type: [approvalLogSchema], default: [] },
}, { timestamps: true });
exports.WorkflowInstance = mongoose_1.default.model('WorkflowInstance', workflowInstanceSchema);
