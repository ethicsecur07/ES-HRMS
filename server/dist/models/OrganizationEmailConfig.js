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
exports.OrganizationEmailConfig = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_js_1 = require("../utils/crypto.js");
const organizationEmailConfigSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    provider: {
        type: String,
        enum: ['GMAIL', 'OUTLOOK', 'CUSTOM'],
        required: true,
        default: 'CUSTOM',
    },
    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPassword: {
        type: String,
        set: (val) => {
            if (!val)
                return val;
            // Check if it's already encrypted to avoid double encryption
            if (val.includes(':') && val.split(':').length === 3)
                return val;
            return (0, crypto_js_1.encrypt)(val);
        },
        get: (val) => {
            if (!val)
                return val;
            return (0, crypto_js_1.decrypt)(val);
        }
    },
    fromEmail: { type: String },
    fromName: { type: String },
}, {
    timestamps: true,
    toJSON: { getters: true }, // Ensure getters run on toJSON
    toObject: { getters: true }
});
organizationEmailConfigSchema.index({ organizationId: 1 }, { unique: true });
exports.OrganizationEmailConfig = mongoose_1.default.model('OrganizationEmailConfig', organizationEmailConfigSchema);
