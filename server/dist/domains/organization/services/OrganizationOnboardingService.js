"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationOnboardingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Organization_js_1 = require("../../../models/Organization.js");
const User_js_1 = require("../../../models/User.js");
const OrganizationEmailConfig_js_1 = require("../../../models/OrganizationEmailConfig.js");
const PasswordService_js_1 = require("../../auth-engine/services/PasswordService.js");
class OrganizationOnboardingService {
    /**
     * Registers a new SaaS tenant and provisions the initial Admin user atomically.
     */
    static async registerTenant(payload) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const slug = payload.organizationSlug.toLowerCase().trim();
            const email = payload.adminEmail.toLowerCase().trim();
            // Check for existing slug globally
            const existingOrg = await Organization_js_1.Organization.findOne({ slug }).session(session);
            if (existingOrg) {
                throw new Error(`Organization with slug '${slug}' already exists.`);
            }
            // 1. Create Organization
            const org = new Organization_js_1.Organization({
                name: payload.organizationName,
                slug,
                sector: payload.sector,
                isActive: true,
            });
            await org.save({ session });
            // Check if user already exists in this new org (unlikely since org is new, but for safety)
            const existingUser = await User_js_1.User.findOne({ email, organizationId: org._id }).session(session);
            if (existingUser) {
                throw new Error(`User with email '${email}' already exists in this organization.`);
            }
            // 2. Hash Password
            const hashedPassword = await PasswordService_js_1.PasswordService.hashPassword(payload.adminPassword);
            // 3. Create Admin User
            const admin = new User_js_1.User({
                organizationId: org._id,
                name: payload.adminName,
                email,
                password: hashedPassword,
                role: 'ADMIN',
                isActive: true,
            });
            await admin.save({ session });
            // 4. Provision Default Email Config (Custom empty config to be filled later)
            const emailConfig = new OrganizationEmailConfig_js_1.OrganizationEmailConfig({
                organizationId: org._id,
                provider: 'CUSTOM',
            });
            await emailConfig.save({ session });
            // 5. Sync Default Permissions and Roles
            const { PermissionSyncService } = await import('./PermissionSyncService.js');
            await PermissionSyncService.syncForTenant(org._id, session);
            // Commit the transaction
            await session.commitTransaction();
            session.endSession();
            return {
                organization: org,
                adminUser: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
            };
        }
        catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}
exports.OrganizationOnboardingService = OrganizationOnboardingService;
