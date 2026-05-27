"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected successfully!');
    // Fetch MS configuration via Mongoose Model (which automatically decrypts clientSecret)
    const msalConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
        provider: 'MICROSOFT',
        isEnabled: true
    });
    if (!msalConfig) {
        console.error('No enabled Microsoft SSO configuration found.');
        await mongoose_1.default.disconnect();
        return;
    }
    console.log('MS Client ID:', msalConfig.clientId);
    console.log('MS Tenant ID:', msalConfig.tenantId);
    console.log('Decrypted Secret Length:', msalConfig.clientSecret?.length);
    // Exchange credentials for token
    const tenantId = msalConfig.tenantId || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: msalConfig.clientId,
            client_secret: msalConfig.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
        }),
    });
    if (!tokenResponse.ok) {
        console.error('Failed to get token:', await tokenResponse.text());
        await mongoose_1.default.disconnect();
        return;
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    // Fetch users
    let msUsers = [];
    let nextLink = `https://graph.microsoft.com/v1.0/users?$select=displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,mobilePhone,businessPhones,employeeId,employeeHireDate,streetAddress,city,state,postalCode,country`;
    while (nextLink) {
        const pageResponse = await fetch(nextLink, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!pageResponse.ok) {
            console.error('Failed to fetch page:', await pageResponse.text());
            break;
        }
        const pageData = await pageResponse.json();
        msUsers = msUsers.concat(pageData.value || []);
        nextLink = pageData['@odata.nextLink'] || null;
    }
    console.log(`\nTotal Users Fetched from MS Graph: ${msUsers.length}`);
    console.log('\n--- ALL MICROSOFT USER EMAILS ---');
    msUsers.forEach((user, i) => {
        const mail = user.mail || '';
        const upn = user.userPrincipalName || '';
        console.log(`[${i + 1}] Name: ${user.displayName} | UPN: ${upn} | Mail: ${mail}`);
    });
    // Check matching users under the new filter
    console.log('\n--- FILTERED MATCHES (@ethicsecur.co.in or @ethicsecur.com) ---');
    const filtered = msUsers.filter(u => {
        const email = (u.mail || u.userPrincipalName || '').toLowerCase().trim();
        return email.endsWith('@ethicsecur.co.in') || email.endsWith('@ethicsecur.com');
    });
    filtered.forEach((user, i) => {
        const email = (user.mail || user.userPrincipalName || '').toLowerCase().trim();
        console.log(`[${i + 1}] Name: ${user.displayName} | Email: ${email}`);
    });
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error('Error running script:', err);
    process.exit(1);
});
