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
        const mongoURI = process.env.MONGO_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
        await mongoose_1.default.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000
        });
        logger_js_1.logger.info('MongoDB Atlas connected successfully');
    }
    catch (error) {
        logger_js_1.logger.error('MongoDB connection failed. Attempting fallback to In-Memory MongoDB...', { error });
        try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            const uri = mongoServer.getUri();
            await mongoose_1.default.connect(uri);
            logger_js_1.logger.info('In-Memory MongoDB connected successfully as fallback');
        }
        catch (fallbackError) {
            logger_js_1.logger.error('In-Memory MongoDB fallback failed', { fallbackError });
        }
    }
};
exports.connectDB = connectDB;
