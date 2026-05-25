import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const ssoConfig = await OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
  if (ssoConfig) {
    ssoConfig.isEnabled = true;
    await ssoConfig.save();
    console.log('✔ Enabled Microsoft SSO in the database successfully.');
  } else {
    console.log('❌ Microsoft SSO config not found.');
  }
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
