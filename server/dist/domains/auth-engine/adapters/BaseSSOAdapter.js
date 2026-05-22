"use strict";
/**
 * Base SSO Adapter Interface
 * All identity provider adapters must implement this contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSSOAdapter = void 0;
class BaseSSOAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Validate an existing token (optional, not all providers support introspection).
     */
    async validateToken(token) {
        // Default: no-op, subclasses can override
        return true;
    }
    /**
     * Revoke a token (optional).
     */
    async revokeToken(token) {
        // Default: no-op
    }
    /**
     * Map raw profile to standard SSOUserProfile using attributeMapping.
     */
    mapProfile(rawProfile) {
        const mapping = this.config.attributeMapping || { email: 'email', name: 'name' };
        return {
            email: this.getNestedValue(rawProfile, mapping.email) || '',
            name: this.getNestedValue(rawProfile, mapping.name) || '',
            firstName: mapping.firstName ? this.getNestedValue(rawProfile, mapping.firstName) : undefined,
            lastName: mapping.lastName ? this.getNestedValue(rawProfile, mapping.lastName) : undefined,
            groups: mapping.groups ? this.getNestedValue(rawProfile, mapping.groups) : undefined,
            department: mapping.department ? this.getNestedValue(rawProfile, mapping.department) : undefined,
            raw: rawProfile,
        };
    }
    /**
     * Helper to extract nested values from a dot-separated path.
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    }
}
exports.BaseSSOAdapter = BaseSSOAdapter;
