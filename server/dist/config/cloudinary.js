"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const logger_js_1 = require("../utils/logger.js");
const configureCloudinary = () => {
    try {
        cloudinary_1.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo_cloud',
            api_key: process.env.CLOUDINARY_API_KEY || 'demo_key',
            api_secret: process.env.CLOUDINARY_API_SECRET || 'demo_secret',
        });
        logger_js_1.logger.info('Cloudinary configured successfully');
    }
    catch (error) {
        logger_js_1.logger.error('Cloudinary config error', { error });
    }
};
exports.configureCloudinary = configureCloudinary;
