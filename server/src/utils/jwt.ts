import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-ethicsec-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key-ethicsec-2026';

export interface TokenPayload {
  id: string;
  role: string;
  email: string;
  organizationId: string;
  employeeId?: string;
  mfaPending?: boolean;
  sessionId?: string;
  isImpersonated?: boolean;
  originalAdminId?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: { id: string; organizationId: string; sessionId?: string; jti?: string }): string => {
  const tokenPayload = {
    ...payload,
    jti: payload.jti || crypto.randomUUID(),
  };
  return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

// Legacy alias to prevent immediate breakage in unmigrated code
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;
