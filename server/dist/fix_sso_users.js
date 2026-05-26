"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const User_js_1 = require("./models/User.js");
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    // 1. Enable Auto-Provisioning for Microsoft SSO
    const ssoConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
    if (ssoConfig) {
        ssoConfig.autoProvision = true;
        await ssoConfig.save();
        console.log('✔ Enabled Auto-Provisioning for Microsoft SSO.');
    }
    else {
        console.log('❌ Microsoft SSO config not found.');
    }
    // 2. Update Logapriyan's email in DB to match Microsoft login email
    const user = await User_js_1.User.findOne({ email: 'logapriyan@ethicsec.com' });
    if (user) {
        user.email = 'logapriyanm@ethicsecur.co.in';
        await user.save();
        console.log('✔ Updated Logapriyan\'s email to logapriyanm@ethicsecur.co.in in the database.');
    }
    else {
        console.log('Logapriyan user account with email logapriyan@ethicsec.com was not found or already updated.');
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
