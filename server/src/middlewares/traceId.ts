import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface TracedRequest extends Request {
  traceId?: string;
}

export const traceIdMiddleware = (req: TracedRequest, res: Response, next: NextFunction): void => {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
};
