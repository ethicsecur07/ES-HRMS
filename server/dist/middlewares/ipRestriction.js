"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOfficeIP = void 0;
// Simulated office WiFi IP list
const OFFICE_IPS = ['192.168.29.', '127.0.0.1', '::1'];
const verifyOfficeIP = (req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    // Check if IP is in office list
    const isOffice = OFFICE_IPS.some((ip) => ipString.includes(ip));
    // The application now allows all IP networks globally.
    // The attendance controller will automatically mark non-office IPs as WFH.
    // We no longer block access based on IP.
    next();
};
exports.verifyOfficeIP = verifyOfficeIP;
