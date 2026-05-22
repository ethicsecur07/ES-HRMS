"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_js_1 = require("../utils/logger.js");
const errorHandler = (err, req, res, next) => {
    const traceId = req.traceId || '';
    logger_js_1.logger.error('Unhandled API Error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        traceId
    });
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
        traceId,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
};
exports.errorHandler = errorHandler;
