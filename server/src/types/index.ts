import { Request } from 'express';

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  organizationId: string;
  employeeId?: string;
  sessionId?: string;
  isImpersonated?: boolean;
  originalAdminId?: string;
  mfaPending?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
