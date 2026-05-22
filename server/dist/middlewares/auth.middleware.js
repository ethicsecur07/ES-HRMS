"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jwt_js_1 = require("../utils/jwt.js");
const UserSession_js_1 = require("../models/UserSession.js");
const Organization_js_1 = require("../models/Organization.js");
const User_js_1 = require("../models/User.js");
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized access. Token missing.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        // Developer Sandbox Bypass
        if (token.startsWith('demo-jwt-token-')) {
            if (process.env.NODE_ENV === 'production') {
                res.status(401).json({ message: 'Demo tokens disabled in production.' });
                return;
            }
            const demoRole = token.replace('demo-jwt-token-', '').toUpperCase();
            const mockUsers = {
                ADMIN: { id: '605c72ef1f77bcf86cd79101', role: 'ADMIN', email: 'Official@ethicsecur.co.in', organizationId: '605c72ef1f77bcf86cd79001' },
                MANAGER: { id: '605c72ef1f77bcf86cd79404', role: 'MANAGER', email: 'siddharth@ethicsecur.com', organizationId: '605c72ef1f77bcf86cd79001' },
                HR: { id: '605c72ef1f77bcf86cd79202', role: 'HR', email: 'oviya@ethicsecur.com', organizationId: '605c72ef1f77bcf86cd79001' },
                TEAM_LEAD: { id: '605c72ef1f77bcf86cd79505', role: 'TEAM_LEAD', email: 'karthik@ethicsecur.com', organizationId: '605c72ef1f77bcf86cd79001' },
                EMPLOYEE: { id: '605c72ef1f77bcf86cd79303', role: 'EMPLOYEE', email: 'logapriyan@ethicsec.com', organizationId: '605c72ef1f77bcf86cd79001' },
            };
            req.user = mockUsers[demoRole] || mockUsers.EMPLOYEE;
            return next();
        }
        const decoded = (0, jwt_js_1.verifyToken)(token);
        if (decoded.mfaPending) {
            // Only allow requests to the MFA verify endpoint
            if (req.path !== '/mfa/verify' && !req.path.endsWith('/mfa/verify')) {
                res.status(401).json({ message: 'MFA verification required.', mfaRequired: true });
                return;
            }
            req.user = decoded;
            return next();
        }
        if (decoded.sessionId) {
            const session = await UserSession_js_1.UserSession.findById(decoded.sessionId);
            if (!session || session.isRevoked || session.expiresAt < new Date()) {
                res.status(401).json({ message: 'Session expired or revoked.' });
                return;
            }
            const org = await Organization_js_1.Organization.findById(decoded.organizationId);
            if (!org || !org.isActive) {
                res.status(401).json({ message: 'Organization is inactive or deactivated.' });
                return;
            }
            const user = await User_js_1.User.findById(decoded.id);
            if (!user || !user.isActive || user.isBlocked) {
                res.status(401).json({ message: 'User is inactive or blocked.' });
                return;
            }
            // Update session activity
            session.lastActivity = new Date();
            await session.save();
        }
        req.user = decoded;
        next();
    }
    catch (error) {
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
