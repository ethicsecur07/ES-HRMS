"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = void 0;
const AuditLog_js_1 = require("../models/AuditLog.js");
const logger_js_1 = require("../utils/logger.js");
const createAuditLog = async (action, performedBy, module, affectedRecord, details) => {
    try {
        await AuditLog_js_1.AuditLog.create({
            action,
            performedBy,
            module,
            affectedRecord,
            details,
        });
        logger_js_1.logger.info(`Audit Log: [${module}] ${action} by ${performedBy}`);
    }
    catch (error) {
        logger_js_1.logger.error('Failed to create audit log', { error });
    }
};
exports.createAuditLog = createAuditLog;
