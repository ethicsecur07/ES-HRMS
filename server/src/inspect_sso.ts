import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const configs = await OrganizationAuthConfig.find({ provider: 'MICROSOFT' });
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
