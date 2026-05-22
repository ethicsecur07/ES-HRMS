import { ComplianceLog } from '../models/ComplianceLog.js';
import mongoose from 'mongoose';

export const logComplianceEvent = async (params: {
  organizationId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  username?: string;
  ipAddress: string;
  eventType: 'ACCESS_VIOLATION' | 'UNAUTHORIZED_IP_LOGIN' | 'PRIVILEGE_ESCALATION' | 'SUSPICIOUS_ACTIVITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
  userAgent?: string;
}) => {
  try {
    const log = new ComplianceLog(params);
    await log.save();
    console.log(`[COMPLIANCE LOG] [${params.severity}] ${params.eventType} logged for user: ${params.username || 'Anonymous'}`);
    return log;
  } catch (err) {
    console.error('Failed to save compliance log:', err);
  }
};
