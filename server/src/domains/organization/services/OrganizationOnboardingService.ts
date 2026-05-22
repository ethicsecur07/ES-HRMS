import mongoose from 'mongoose';
import { Organization } from '../../../models/Organization.js';
import { User } from '../../../models/User.js';
import { OrganizationEmailConfig } from '../../../models/OrganizationEmailConfig.js';
import { PasswordService } from '../../auth-engine/services/PasswordService.js';

export interface OnboardingPayload {
  organizationName: string;
  organizationSlug: string;
  sector: 'IT' | 'Startups' | 'Manufacturing' | 'Hospitals' | 'Schools' | 'Logistics' | 'Agencies' | 'Enterprises';
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export class OrganizationOnboardingService {
  /**
   * Registers a new SaaS tenant and provisions the initial Admin user atomically.
   */
  static async registerTenant(payload: OnboardingPayload) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const slug = payload.organizationSlug.toLowerCase().trim();
      const email = payload.adminEmail.toLowerCase().trim();

      // Check for existing slug globally
      const existingOrg = await Organization.findOne({ slug }).session(session);
      if (existingOrg) {
        throw new Error(`Organization with slug '${slug}' already exists.`);
      }

      // 1. Create Organization
      const org = new Organization({
        name: payload.organizationName,
        slug,
        sector: payload.sector,
        isActive: true,
      });
      await org.save({ session });

      // Check if user already exists in this new org (unlikely since org is new, but for safety)
      const existingUser = await User.findOne({ email, organizationId: org._id }).session(session);
      if (existingUser) {
        throw new Error(`User with email '${email}' already exists in this organization.`);
      }

      // 2. Hash Password
      const hashedPassword = await PasswordService.hashPassword(payload.adminPassword);

      // 3. Create Admin User
      const admin = new User({
        organizationId: org._id,
        name: payload.adminName,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      });
      await admin.save({ session });

      // 4. Provision Default Email Config (Custom empty config to be filled later)
      const emailConfig = new OrganizationEmailConfig({
        organizationId: org._id,
        provider: 'CUSTOM',
      });
      await emailConfig.save({ session });

      // 5. Sync Default Permissions and Roles
      const { PermissionSyncService } = await import('./PermissionSyncService.js');
      await PermissionSyncService.syncForTenant(org._id as any, session as any);

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return {
        organization: org,
        adminUser: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}
