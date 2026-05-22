"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logComplianceEvent = void 0;
const ComplianceLog_js_1 = require("../models/ComplianceLog.js");
const logComplianceEvent = async (params) => {
    try {
        const log = new ComplianceLog_js_1.ComplianceLog(params);
        await log.save();
        console.log(`[COMPLIANCE LOG] [${params.severity}] ${params.eventType} logged for user: ${params.username || 'Anonymous'}`);
        return log;
    }
    catch (err) {
        console.error('Failed to save compliance log:', err);
    }
};
exports.logComplianceEvent = logComplianceEvent;
