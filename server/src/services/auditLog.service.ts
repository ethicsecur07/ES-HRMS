import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

export const createAuditLog = async (
  action: string,
  performedBy: string,
  module: string,
  affectedRecord: string,
  details?: string
): Promise<void> => {
  try {
    await AuditLog.create({
      action,
      performedBy,
      module,
      affectedRecord,
      details,
    });
    logger.info(`Audit Log: [${module}] ${action} by ${performedBy}`);
  } catch (error) {
    logger.error('Failed to create audit log', { error });
  }
};
