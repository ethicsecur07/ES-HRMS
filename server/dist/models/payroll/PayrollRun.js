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
exports.PayrollRun = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const payrollRunSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    runCycle: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'LOCKED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'], default: 'DRAFT' },
    totalProcessedCount: { type: Number, default: 0 },
    totalFailedCount: { type: Number, default: 0 },
    totalPayoutAmount: { type: Number, default: 0 },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    processingLog: [{ type: String }]
}, { timestamps: true });
payrollRunSchema.index({ organizationId: 1, runCycle: 1 }, { unique: true });
exports.PayrollRun = mongoose_1.default.model('PayrollRun', payrollRunSchema);
