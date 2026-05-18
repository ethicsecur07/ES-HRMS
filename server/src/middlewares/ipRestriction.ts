import { Request, Response, NextFunction } from 'express';

// Simulated office WiFi IP list
const OFFICE_IPS = ['192.168.29.', '127.0.0.1', '::1'];

export const verifyOfficeIP = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '192.168.29.50';
  const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;

  // Check if IP is in office list or if override exists
  const isOffice = OFFICE_IPS.some((ip) => ipString.includes(ip));

  if (!isOffice && !req.body.overrideReason) {
    res.status(403).json({
      success: false,
      message: 'Access Denied: Attendance check-in is restricted to Office WiFi IP. Please provide approved WFH override justification.',
      currentIP: ipString,
    });
    return;
  }

  next();
};
