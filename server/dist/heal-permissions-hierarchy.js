"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const Role_js_1 = require("./models/Role.js");
const Permission_js_1 = require("./models/Permission.js");
const PermissionSyncService_js_1 = require("./domains/organization/services/PermissionSyncService.js");
const redisClient_js_1 = require("./utils/redisClient.js");
const MONGODB_URI = process.env.MONGODB_URI;
const TARGET_ORG_ID = '6a1ed6b76cd721e1f9d4e96c';
async function run() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not found in .env');
        return;
    }
    console.log('Connecting to MongoDB...');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected.');
    const orgObjectId = new mongoose_1.default.Types.ObjectId(TARGET_ORG_ID);
    console.log('Step 1: Running PermissionSyncService to sync roles and default permissions...');
    await PermissionSyncService_js_1.PermissionSyncService.syncForTenant(orgObjectId, undefined, true);
    console.log('Sync complete.');
    console.log('Step 2: Retrieving valid roles...');
    const validRoles = await Role_js_1.Role.find({ organizationId: orgObjectId });
    console.log(`Found ${validRoles.length} valid roles:`);
    for (const r of validRoles) {
        console.log(`- ${r.code}: ID = ${r._id}, parent = ${r.parentRoleId}`);
    }
    const validRoleIds = validRoles.map(r => r._id.toString());
    console.log('Step 3: Cleaning up dangling permissions for invalid/old role IDs...');
    const allPermissions = await Permission_js_1.Permission.find({ organizationId: orgObjectId });
    let deleteCount = 0;
    for (const p of allPermissions) {
        if (p.roleId && !validRoleIds.includes(p.roleId.toString())) {
            await Permission_js_1.Permission.deleteOne({ _id: p._id });
            deleteCount++;
        }
    }
    console.log(`Deleted ${deleteCount} dangling permission documents.`);
    console.log('Step 4: Clearing Redis RBAC cache...');
    await (0, redisClient_js_1.redisClearPattern)(`rbac:${TARGET_ORG_ID}:*`);
    console.log('Redis cache cleared.');
    console.log('Step 5: Verifying roles and permissions in DB...');
    const finalRoles = await Role_js_1.Role.find({ organizationId: orgObjectId });
    const finalPermsCount = await Permission_js_1.Permission.countDocuments({ organizationId: orgObjectId });
    console.log(`Verification: ${finalRoles.length} roles and ${finalPermsCount} total permissions in DB.`);
    await mongoose_1.default.disconnect();
    console.log('Healer script finished successfully.');
}
run().catch(console.error);
