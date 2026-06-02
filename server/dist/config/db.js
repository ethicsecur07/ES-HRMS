"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_js_1 = require("../utils/logger.js");
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
        await mongoose_1.default.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000
        });
        logger_js_1.logger.info('MongoDB Atlas connected successfully');
    }
    catch (error) {
        logger_js_1.logger.error('MongoDB connection failed.', { error });
        process.exit(1);
    }
};
exports.connectDB = connectDB;
