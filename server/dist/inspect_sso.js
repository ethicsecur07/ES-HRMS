"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    const configs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({ provider: 'MICROSOFT' });
    for (const c of configs) {
        console.log('--- MICROSOFT CONFIG ---');
        console.log('ID:', c._id);
        console.log('OrgId:', c.organizationId);
        console.log('DisplayName:', c.displayName);
        console.log('ClientId:', c.clientId);
        console.log('ClientSecret (Decrypted):', c.clientSecret ? '***Exists***' : '***Missing***');
        console.log('RedirectUri:', c.redirectUri);
        console.log('TenantId:', c.tenantId);
        console.log('Scopes:', c.scopes);
        console.log('isEnabled:', c.isEnabled);
        console.log('isPrimary:', c.isPrimary);
        console.log('autoProvision:', c.autoProvision);
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
