import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Enable collection of default metrics (process, memory, etc.)
client.collectDefaultMetrics();

export const metricsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/metrics') {
    return next();
  }
  try {
    const metrics = await client.register.metrics();
    res.setHeader('Content-Type', client.register.contentType);
    res.end(metrics);
  } catch (err) {
    next(err);
  }
};
