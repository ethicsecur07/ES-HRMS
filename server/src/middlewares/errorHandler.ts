import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { TracedRequest } from './traceId.js';

export const errorHandler = (err: any, req: TracedRequest, res: Response, next: NextFunction): void => {
  const traceId = req.traceId || '';
  logger.error('Unhandled API Error', { 
    error: err.message, 
    stack: err.stack, 
    path: req.path,
    traceId
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    traceId,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

