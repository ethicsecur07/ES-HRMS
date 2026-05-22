import { Response, Request, NextFunction } from 'express';

export const cspHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const policy = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;";
  res.setHeader('Content-Security-Policy', policy);
  next();
};
