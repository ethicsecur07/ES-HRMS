"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = exports.uploadImage = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const onedrive_js_1 = require("../utils/onedrive.js");
const UploadedFile_js_1 = require("../models/UploadedFile.js");
const s3_js_1 = require("../utils/s3.js");
const logger_js_1 = require("../utils/logger.js");
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});
const uploadImage = async (req, res) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
        res.status(400).json({ message: 'User organization context is missing.' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }
    try {
        const userEmail = req.user?.email;
        // 1. Upload file buffer to OneDrive
        const onedriveResult = await (0, onedrive_js_1.uploadFileToOneDrive)(orgId, req.file.buffer, req.file.originalname, req.file.mimetype, 'uploads/profiles', userEmail);
        // 2. Generate a public sharing link
        const sharingUrl = await (0, onedrive_js_1.generateSharingLink)(orgId, onedriveResult.fileId, userEmail);
        // 3. Store file metadata in MongoDB
        const fileRecord = await UploadedFile_js_1.UploadedFile.create({
            organizationId: orgId,
            fileName: onedriveResult.fileName,
            fileId: onedriveResult.fileId,
            url: sharingUrl,
            uploadedAt: new Date(),
            mimeType: req.file.mimetype,
            size: onedriveResult.size,
        });
        logger_js_1.logger.info(`[UploadController] Image uploaded to OneDrive: ${fileRecord.fileName} (${fileRecord.fileId})`);
        // 4. Return sharing URL and metadata
        res.status(200).json({
            success: true,
            url: fileRecord.url,
            metadata: {
                fileId: fileRecord.fileId,
                fileName: fileRecord.fileName,
                uploadedAt: fileRecord.uploadedAt,
            },
        });
    }
    catch (error) {
        logger_js_1.logger.error('[UploadController] Error uploading image to OneDrive:', error);
        res.status(500).json({ message: error.message || 'Error uploading image to OneDrive' });
    }
};
exports.uploadImage = uploadImage;
const uploadDocument = async (req, res) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
        res.status(400).json({ message: 'User organization context is missing.' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }
    try {
        const userEmail = req.user?.email;
        // Pass organizationId and userEmail to uploadFileToS3 for OneDrive fallback compatibility
        const url = await (0, s3_js_1.uploadFileToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, orgId, userEmail);
        res.status(200).json({ url });
    }
    catch (error) {
        logger_js_1.logger.error('[UploadController] Error uploading document:', error);
        res.status(500).json({ message: error.message || 'Error uploading document' });
    }
};
exports.uploadDocument = uploadDocument;
