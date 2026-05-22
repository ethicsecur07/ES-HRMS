import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AuthRequest, AuthUser } from '../types/index.js';
import { UserSession } from '../models/UserSession.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized access. Token missing.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Developer Sandbox Bypass
    if (token.startsWith('demo-jwt-token-')) {
      if (process.env.NODE_ENV === 'production') {
        res.status(401).json({ message: 'Demo tokens disabled in production.' });
        return;
      }
      const demoRole = token.replace('demo-jwt-token-', '').toUpperCase();
      const mockUsers: Record<string, any> = {
        ADMIN: { role: 'ADMIN', email: 'Official@ethicsecur.co.in' },
        MANAGER: { role: 'MANAGER', email: 'siddharth@ethicsecur.com' },
        HR: { role: 'HR', email: 'oviya@ethicsecur.com' },
        TEAM_LEAD: { role: 'TEAM_LEAD', email: 'karthik@ethicsecur.com' },
        EMPLOYEE: { role: 'EMPLOYEE', email: 'logapriyan@ethicsec.com' },
      };
      
      const targetUser = mockUsers[demoRole] || mockUsers.EMPLOYEE;
      const dbUser = await User.findOne({ email: new RegExp('^' + targetUser.email + '$', 'i') });

      if (dbUser) {
        req.user = {
          id: dbUser.id,
          role: dbUser.role,
          email: dbUser.email,
          organizationId: dbUser.organizationId.toString(),
          employeeId: dbUser.employeeId?.toString()
        };
        return next();
      } else {
        res.status(404).json({ message: 'Demo user not found in database. Run seed script.' });
        return;
      }
    }

    const decoded = verifyToken(token) as AuthUser;

    if (decoded.mfaPending) {
      // Only allow requests to the MFA verify endpoint
      if (req.path !== '/mfa/verify' && !req.path.endsWith('/mfa/verify')) {
        res.status(401).json({ message: 'MFA verification required.', mfaRequired: true });
        return;
      }
      req.user = decoded;
      return next();
    }

    if (decoded.sessionId) {
      const session = await UserSession.findById(decoded.sessionId);
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        res.status(401).json({ message: 'Session expired or revoked.' });
        return;
      }

      const org = await Organization.findById(decoded.organizationId);
      if (!org || !org.isActive) {
        res.status(401).json({ message: 'Organization is inactive or deactivated.' });
        return;
      }

      const user = await User.findById(decoded.id);
      if (!user || !user.isActive || user.isBlocked) {
        res.status(401).json({ message: 'User is inactive or blocked.' });
        return;
      }

      // Update session activity
      session.lastActivity = new Date();
      await session.save();
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
      return;
    }
    next();
  };
};
