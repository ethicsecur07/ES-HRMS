"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicantService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const r2_config_js_1 = require("../config/r2.config.js");
const applicant_model_js_1 = require("../models/applicant.model.js");
const s3_js_1 = require("../utils/s3.js");
const crypto_1 = __importDefault(require("crypto"));
const logger_js_1 = require("../utils/logger.js");
class ApplicantService {
    static async uploadResume(file) {
        if (r2_config_js_1.r2Client && process.env.R2_BUCKET) {
            try {
                const key = `resumes/${crypto_1.default.randomUUID()}.pdf`;
                await r2_config_js_1.r2Client.send(new client_s3_1.PutObjectCommand({
                    Bucket: process.env.R2_BUCKET,
                    Key: key,
                    Body: file.buffer,
                    ContentType: 'application/pdf'
                }));
                const publicUrl = process.env.ES_PUBLIC_URL || `https://${process.env.R2_BUCKET}.r2.cloudflarestorage.com`;
                const fileUrl = `${publicUrl.replace(/\/$/, '')}/${key}`;
                logger_js_1.logger.info(`[ApplicantService] Successfully uploaded resume to Cloudflare R2: ${fileUrl}`);
                return fileUrl;
            }
            catch (r2Error) {
                logger_js_1.logger.error('[ApplicantService] Cloudflare R2 upload failed, falling back to S3/Cloudinary uploader', { error: r2Error.message });
            }
        }
        // Fallback to S3/Cloudinary
        logger_js_1.logger.info('[ApplicantService] R2 not configured or failed, using Cloudinary/S3 uploader fallback.');
        return await (0, s3_js_1.uploadFileToS3)(file.buffer, file.originalname, file.mimetype || 'application/pdf');
    }
    static async createApplicant(data) {
        return applicant_model_js_1.ApplicantModel.create(data);
    }
    static async getAllApplicants() {
        return applicant_model_js_1.ApplicantModel.find().sort({ createdAt: -1 });
    }
    static async getApplicantById(id) {
        return applicant_model_js_1.ApplicantModel.findById(id);
    }
}
exports.ApplicantService = ApplicantService;
