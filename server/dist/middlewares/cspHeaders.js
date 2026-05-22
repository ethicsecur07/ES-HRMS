"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cspHeaders = void 0;
const cspHeaders = (req, res, next) => {
    const policy = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;";
    res.setHeader('Content-Security-Policy', policy);
    next();
};
exports.cspHeaders = cspHeaders;
