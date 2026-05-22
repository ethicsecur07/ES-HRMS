"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToS3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const cloudinary_1 = require("cloudinary");
const logger_js_1 = require("./logger.js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;
let s3Client = null;
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION) {
    s3Client = new client_s3_1.S3Client({
        region: AWS_REGION,
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY
        }
    });
    logger_js_1.logger.info('AWS S3 Client Initialized successfully');
}
else {
    logger_js_1.logger.warn('AWS credentials not fully configured in environment. File uploads will fall back to Cloudinary.');
}
/**
 * Uploads a file buffer to S3, falling back to Cloudinary if S3 credentials are not set.
 */
const uploadFileToS3 = async (fileBuffer, fileName, mimeType) => {
    if (s3Client && AWS_S3_BUCKET && AWS_REGION) {
        try {
            const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
            const upload = new lib_storage_1.Upload({
                client: s3Client,
                params: {
                    Bucket: AWS_S3_BUCKET,
                    Key: `documents/${uniqueFileName}`,
                    Body: fileBuffer,
                    ContentType: mimeType,
                }
            });
            await upload.done();
            return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/documents/${uniqueFileName}`;
        }
        catch (error) {
            logger_js_1.logger.error('S3 upload error, falling back to Cloudinary:', error);
        }
    }
    // Fallback to Cloudinary
    try {
        const b64 = fileBuffer.toString('base64');
        const dataURI = `data:${mimeType};base64,${b64}`;
        const result = await cloudinary_1.v2.uploader.upload(dataURI, {
            folder: 'es_hrms_documents',
            resource_type: 'auto',
        });
        return result.secure_url;
    }
    catch (cloudinaryError) {
        logger_js_1.logger.error('Cloudinary fallback upload failed:', cloudinaryError);
        throw new Error(`Upload failed: ${cloudinaryError.message || cloudinaryError}`, { cause: cloudinaryError });
    }
};
exports.uploadFileToS3 = uploadFileToS3;
