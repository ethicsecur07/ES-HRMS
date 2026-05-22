/**
 * auditLog.service.ts (FIXED)
 * ----------------------------
 * Critical Fix: organizationId is now REQUIRED.
 * Removes dangerous Organization.findOne() fallback that was assigning
 * audit logs to the wrong tenant when organizationId was not passed.
 * 
 * All callers MUST pass organizationId explicitly.
 */

import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

export const createAuditLog = async (
  action: string,
  performedBy: string,
  module: string,
  affectedRecord: string,
  details?: string,
  organizationId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    if (!organizationId) {
      // SECURITY: Do NOT fall back to Organization.findOne() — log the gap instead
      logger.warn(`[AuditLog] MISSING organizationId for action "${action}" by "${performedBy}" on module "${module}". Log skipped to prevent cross-tenant contamination.`);
      return;
    }

    await AuditLog.create({
      organizationId,
      action,
      performedBy,
      module,
      affectedRecord: String(affectedRecord),
      details: details ?? '',
      timestamp: new Date(),
    });

    logger.info(`[AuditLog] ${module}.${action} by ${performedBy}`);
  } catch (error) {
    // Audit failures must never crash the main operation
    logger.error('[AuditLog] Failed to create audit log', { error, action, module });
  }
};
