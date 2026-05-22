"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleGuard = void 0;
const OrganizationModule_1 = require("../models/OrganizationModule");
/**
 * moduleGuard middleware generator.
 * @param requiredModules - array of module codes that must be enabled for the request to proceed.
 */
const moduleGuard = (requiredModules) => {
    return async (req, res, next) => {
        try {
            // Assuming authentication middleware already attached a `user` object with organizationId
            const orgId = req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ success: false, data: null, traceId: req.headers['x-trace-id'] || '' });
            }
            // Fetch enabled modules for this organization
            const enabledModules = await OrganizationModule_1.OrganizationModule.find({
                organizationId: orgId,
                isEnabled: true,
            }).select('moduleCode');
            const enabledSet = new Set(enabledModules.map((m) => m.moduleCode));
            const missing = requiredModules.filter((mod) => !enabledSet.has(mod));
            if (missing.length > 0) {
                return res.status(403).json({
                    success: false,
                    data: { missingModules: missing },
                    traceId: req.headers['x-trace-id'] || '',
                    message: 'Required module(s) not enabled for this organization',
                });
            }
            // All good
            next();
        }
        catch (err) {
            console.error('moduleGuard error:', err);
            return res.status(500).json({ success: false, data: null, traceId: req.headers['x-trace-id'] || '' });
        }
    };
};
exports.moduleGuard = moduleGuard;
