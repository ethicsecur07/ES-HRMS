import helmet from 'helmet';
// @ts-expect-error missing types
import xss from 'xss-clean';
// @ts-expect-error missing types
import hpp from 'hpp';
import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import * as Sentry from '@sentry/node';

export const securityHeaders = helmet({
  contentSecurityPolicy: false, // We'll set CSP separately via cspHeaders
});

export const xssProtection = xss();

export const hppProtection = hpp();

// Combined middleware for convenience
export const secureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  securityHeaders(req, res, () => {
    xssProtection(req, res, () => {
      hppProtection(req, res, next);
    });
  });
};
