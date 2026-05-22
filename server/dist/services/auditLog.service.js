"use strict";
/**
 * auditLog.service.ts (FIXED)
 * ----------------------------
 * Critical Fix: organizationId is now REQUIRED.
 * Removes dangerous Organization.findOne() fallback that was assigning
 * audit logs to the wrong tenant when organizationId was not passed.
 *
 * All callers MUST pass organizationId explicitly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = void 0;
const AuditLog_js_1 = require("../models/AuditLog.js");
const logger_js_1 = require("../utils/logger.js");
const createAuditLog = async (action, performedBy, module, affectedRecord, details, organizationId) => {
    try {
        if (!organizationId) {
            // SECURITY: Do NOT fall back to Organization.findOne() — log the gap instead
            logger_js_1.logger.warn(`[AuditLog] MISSING organizationId for action "${action}" by "${performedBy}" on module "${module}". Log skipped to prevent cross-tenant contamination.`);
            return;
        }
        await AuditLog_js_1.AuditLog.create({
            organizationId,
            action,
            performedBy,
            module,
            affectedRecord: String(affectedRecord),
            details: details ?? '',
            timestamp: new Date(),
        });
        logger_js_1.logger.info(`[AuditLog] ${module}.${action} by ${performedBy}`);
    }
    catch (error) {
        // Audit failures must never crash the main operation
        logger_js_1.logger.error('[AuditLog] Failed to create audit log', { error, action, module });
    }
};
exports.createAuditLog = createAuditLog;
