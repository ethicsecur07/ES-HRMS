import { SessionPolicy, ISessionPolicy } from '../models/SessionPolicy.js';

/**
 * SessionPolicyService
 * Manages session policies per organization and enforces session constraints.
 */
export class SessionPolicyService {
  /**
   * Get the active session policy for an organization.
   * Falls back to the default policy.
   */
  static async getPolicy(organizationId: string): Promise<ISessionPolicy | null> {
    // Try org-specific default policy
    let policy = await SessionPolicy.findOne({
      organizationId,
      isDefault: true,
      isActive: true,
    });

    if (!policy) {
      // Try any active policy for the org
      policy = await SessionPolicy.findOne({
        organizationId,
        isActive: true,
      });
    }

    return policy;
  }

  /**
   * Create a new session policy for an organization.
   */
  static async createPolicy(
    organizationId: string,
    data: Partial<ISessionPolicy>
  ): Promise<ISessionPolicy> {
    // If this is set as default, un-default others
    if (data.isDefault) {
      await SessionPolicy.updateMany(
        { organizationId, isDefault: true },
        { isDefault: false }
      );
    }

    return SessionPolicy.create({
      organizationId,
      ...data,
    });
  }

  /**
   * Update a session policy.
   */
  static async updatePolicy(
    policyId: string,
    organizationId: string,
    data: Partial<ISessionPolicy>
  ): Promise<ISessionPolicy | null> {
    if (data.isDefault) {
      await SessionPolicy.updateMany(
        { organizationId, isDefault: true, _id: { $ne: policyId } },
        { isDefault: false }
      );
    }

    return SessionPolicy.findOneAndUpdate(
      { _id: policyId, organizationId },
      data,
      { new: true }
    );
  }

  /**
   * Validate an IP against the policy whitelist/blacklist.
   */
  static validateIP(policy: ISessionPolicy, ipAddress: string): {
    allowed: boolean;
    reason?: string;
  } {
    if (!policy.enforceIpRestriction) {
      return { allowed: true };
    }

    // Check blacklist first
    if (policy.ipBlacklist.length > 0) {
      const isBlacklisted = policy.ipBlacklist.some((pattern) =>
        this.matchIPPattern(ipAddress, pattern)
      );
      if (isBlacklisted) {
        return { allowed: false, reason: 'IP address is blacklisted' };
      }
    }

    // Check whitelist (if whitelist exists, IP must be in it)
    if (policy.ipWhitelist.length > 0) {
      const isWhitelisted = policy.ipWhitelist.some((pattern) =>
        this.matchIPPattern(ipAddress, pattern)
      );
      if (!isWhitelisted) {
        return { allowed: false, reason: 'IP address is not in the whitelist' };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate password against policy rules.
   */
  static validatePassword(policy: ISessionPolicy, password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < policy.passwordMinLength) {
      errors.push(`Password must be at least ${policy.passwordMinLength} characters`);
    }
    if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (policy.passwordRequireNumber && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (policy.passwordRequireSpecial && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get all policies for an organization (admin view).
   */
  static async listPolicies(organizationId: string): Promise<ISessionPolicy[]> {
    return SessionPolicy.find({ organizationId }).sort({ isDefault: -1, name: 1 });
  }

  /**
   * Delete a session policy (cannot delete the default).
   */
  static async deletePolicy(policyId: string, organizationId: string): Promise<boolean> {
    const policy = await SessionPolicy.findOne({ _id: policyId, organizationId });
    if (!policy) return false;
    if (policy.isDefault) {
      throw new Error('Cannot delete the default session policy');
    }
    await policy.deleteOne();
    return true;
  }

  // ---- Private Helpers ----

  /**
   * Match IP against a pattern. Supports:
   * - Exact match: '192.168.1.1'
   * - Prefix match: '192.168.1.'
   * - CIDR (simplified): '192.168.1.0/24'
   */
  private static matchIPPattern(ip: string, pattern: string): boolean {
    if (pattern.includes('/')) {
      // Simplified CIDR match
      const [subnet, bits] = pattern.split('/');
      const subnetParts = subnet.split('.').map(Number);
      const ipParts = ip.split('.').map(Number);
      const mask = parseInt(bits, 10);
      const subnetInt =
        (subnetParts[0] << 24) | (subnetParts[1] << 16) | (subnetParts[2] << 8) | subnetParts[3];
      const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
      const maskInt = ~((1 << (32 - mask)) - 1);
      return (subnetInt & maskInt) === (ipInt & maskInt);
    }

    // Prefix or exact match
    return ip.startsWith(pattern) || ip === pattern;
  }
}
