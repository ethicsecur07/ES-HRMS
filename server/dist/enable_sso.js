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
    const ssoConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
    if (ssoConfig) {
        ssoConfig.isEnabled = true;
        await ssoConfig.save();
        console.log('✔ Enabled Microsoft SSO in the database successfully.');
    }
    else {
        console.log('❌ Microsoft SSO config not found.');
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
