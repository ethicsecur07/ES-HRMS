"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = exports.uploadImage = exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const s3_js_1 = require("../utils/s3.js");
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({ storage });
const uploadImage = async (req, res) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }
    try {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        const result = await cloudinary_1.v2.uploader.upload(dataURI, {
            folder: 'es_hrms_profiles',
            resource_type: 'auto',
        });
        res.status(200).json({ url: result.secure_url });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.uploadImage = uploadImage;
const uploadDocument = async (req, res) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }
    try {
        const url = await (0, s3_js_1.uploadFileToS3)(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.status(200).json({ url });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.uploadDocument = uploadDocument;
