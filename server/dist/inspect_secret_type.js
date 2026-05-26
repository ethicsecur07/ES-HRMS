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
    const c = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
    if (c && c.clientSecret) {
        const secret = c.clientSecret;
        console.log('Secret length:', secret.length);
        // Check if it matches UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(secret)) {
            console.log('--- WARNING ---');
            console.log('The stored client secret IS A UUID!');
            console.log('This means you have entered the Client Secret ID instead of the Client Secret Value!');
        }
        else {
            console.log('The stored client secret is NOT a UUID. It appears to be a standard secret value.');
        }
    }
    else {
        console.log('No Microsoft config or secret found.');
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
