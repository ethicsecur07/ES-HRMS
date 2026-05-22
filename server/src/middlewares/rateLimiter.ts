import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { Organization } from '../models/Organization.js';

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  skip: () => process.env.NODE_ENV !== 'production', // Skip rate limiting in development
  max: async (req: Request) => {
    const orgId = (req as any).user?.organizationId;
    if (orgId) {
      try {
        const org = await Organization.findById(orgId).lean();
        if (org) {
          // Establish API rate limit thresholds based on tenant plans (derived from sector or custom settings)
          if (org.sector === 'Enterprises') return 1500;
          if (org.sector === 'IT') return 800;
          if (org.sector === 'Startups') return 500;
          return 300;
        }
      } catch (err) {
        // Fallback on DB error
      }
    }
    return 200; // default for unauthenticated/anonymous traffic
  },
  keyGenerator: (req: Request) => {
    // Unique key: use organizationId if user is authenticated, else default to IP
    return ((req as any).user?.organizationId || req.ip || '').toString();
  },
  message: { 
    success: false, 
    message: 'Too many requests. Rate limit exceeded for your tenant plan. Please try again in a minute.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

