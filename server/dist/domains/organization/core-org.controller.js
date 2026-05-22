"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganizationSettings = exports.registerOrganization = void 0;
const OrganizationOnboardingService_js_1 = require("./services/OrganizationOnboardingService.js");
const Organization_js_1 = require("../../models/Organization.js");
const registerOrganization = async (req, res) => {
    try {
        const { organizationName, organizationSlug, sector, adminName, adminEmail, adminPassword } = req.body;
        if (!organizationName || !organizationSlug || !sector || !adminName || !adminEmail || !adminPassword) {
            res.status(400).json({ message: 'Missing required onboarding fields' });
            return;
        }
        // This is an atomic operation that creates the Tenant, User, and Configs in one transaction
        const result = await OrganizationOnboardingService_js_1.OrganizationOnboardingService.registerTenant({
            organizationName,
            organizationSlug,
            sector,
            adminName,
            adminEmail,
            adminPassword
        });
        res.status(201).json({
            message: 'Organization registered successfully',
            data: result,
        });
    }
    catch (error) {
        // If it's a known conflict, send 409
        if (error.message?.includes('already exists')) {
            res.status(409).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: error.message || 'Internal server error during registration' });
    }
};
exports.registerOrganization = registerOrganization;
const updateOrganizationSettings = async (req, res) => {
    try {
        // Requires ADMIN role verified by RBAC middleware
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const { settings } = req.body;
        if (!settings) {
            res.status(400).json({ message: 'Settings payload is required' });
            return;
        }
        const org = await Organization_js_1.Organization.findById(orgId);
        if (!org) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }
        // Merge settings
        org.settings = { ...org.settings, ...settings };
        await org.save();
        res.status(200).json({
            message: 'Organization settings updated successfully',
            data: org,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateOrganizationSettings = updateOrganizationSettings;
