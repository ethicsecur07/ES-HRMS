import { Request, Response } from 'express';
import { OrganizationOnboardingService } from './services/OrganizationOnboardingService.js';
import { Organization } from '../../models/Organization.js';
import { AuthRequest } from '../../types/index.js';

export const registerOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationName, organizationSlug, sector, adminName, adminEmail, adminPassword } = req.body;

    if (!organizationName || !organizationSlug || !sector || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ message: 'Missing required onboarding fields' });
      return;
    }

    // This is an atomic operation that creates the Tenant, User, and Configs in one transaction
    const result = await OrganizationOnboardingService.registerTenant({
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
  } catch (error: any) {
    // If it's a known conflict, send 409
    if (error.message?.includes('already exists')) {
      res.status(409).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: error.message || 'Internal server error during registration' });
  }
};

export const updateOrganizationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const org = await Organization.findById(orgId);
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
