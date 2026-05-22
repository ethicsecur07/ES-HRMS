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
exports.FormSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const formFieldSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'select', 'date', 'boolean'], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    validationRegex: { type: String, default: '' },
    defaultValue: { type: String, default: '' },
    dependsOnField: { type: String, default: '' },
    dependsOnValue: { type: String, default: '' },
});
const formSchemaDefinition = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    formCode: { type: String, required: true, uppercase: true, trim: true },
    fields: { type: [formFieldSchema], default: [] },
}, { timestamps: true });
formSchemaDefinition.index({ organizationId: 1, formCode: 1 }, { unique: true });
exports.FormSchema = mongoose_1.default.model('FormSchema', formSchemaDefinition);
