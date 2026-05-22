"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
const Organization_js_1 = require("./models/Organization.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    const configs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({});
    console.log('Total Auth Configs:', configs.length);
    for (const c of configs) {
        console.log(`OrgId: ${c.organizationId}, Provider: ${c.provider}, Enabled: ${c.isEnabled}`);
    }
    const techOrg = await Organization_js_1.Organization.findOne({ slug: 'tech' });
    if (techOrg) {
        console.log('techOrg ID:', techOrg._id);
        const techConfigs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({ organizationId: techOrg._id });
        console.log('techConfigs count:', techConfigs.length);
        for (const c of techConfigs) {
            console.log(`  Provider: ${c.provider}, Enabled: ${c.isEnabled}`);
        }
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
