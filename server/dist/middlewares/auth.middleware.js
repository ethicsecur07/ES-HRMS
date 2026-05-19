"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jwt_js_1 = require("../utils/jwt.js");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized access. Token missing.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    // Support demo tokens flawlessly matching seeded Enterprise records
    if (token.startsWith('demo-jwt-token-')) {
        const roleStr = token.replace('demo-jwt-token-', '').toUpperCase();
        if (roleStr === 'ADMIN') {
            req.user = { id: '605c72ef1f77bcf86cd79101', role: 'ADMIN', email: 'Official@ethicsecur.co.in' };
        }
        else if (roleStr === 'HR') {
            req.user = { id: '605c72ef1f77bcf86cd79202', role: 'HR', email: 'oviya@ethicsecur.com' };
        }
        else {
            req.user = { id: '605c72ef1f77bcf86cd79303', role: 'EMPLOYEE', email: 'logapriyan@ethicsec.com' };
        }
        next();
        return;
    }
    try {
        const decoded = (0, jwt_js_1.verifyToken)(token);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired token.' });
        return;
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
