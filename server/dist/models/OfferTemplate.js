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
exports.OfferTemplate = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OfferTemplateSchema = new mongoose_1.Schema({
    name: { type: String, required: true, default: 'Default Offer Template' },
    subject: { type: String, required: true, default: 'Job Offer: {{appliedRole}} - ES EthicSecur SofTec Pvt Ltd' },
    bodyText: { type: String, required: true },
    pdfTitle: { type: String, required: true, default: 'Internship Offer Letter' },
    pdfSubject: { type: String, required: true, default: 'Subject: Intern Offer letter- {{appliedRole}}' },
    emailBody: {
        type: String,
        required: true,
        default: `Dear {{candidateName}},

We are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.

To accept this offer, please sign the letter and return it by replying to this email.

We look forward to welcoming you to the team!

Best regards,
HR Department
ES EthicSecur SofTec Pvt Ltd`
    },
    footerPhone: { type: String, default: '755028487' },
    footerEmail: { type: String, default: 'info@ethicsecur.com' },
    footerWebsite: { type: String, default: 'www.ethicsecur.com' },
    footerAddress: { type: String, default: '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004' },
    signatoryName: { type: String, default: 'ES EthicSecur SofTec Private Limited' },
    signatoryTitle: { type: String, default: 'HR Department' },
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
}, { timestamps: true });
exports.OfferTemplate = mongoose_1.default.model('OfferTemplate', OfferTemplateSchema);
