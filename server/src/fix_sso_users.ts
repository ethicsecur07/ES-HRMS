import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';

dotenv.config();

const run = async () => {
  await connectDB();
  
  // 1. Enable Auto-Provisioning for Microsoft SSO
  const ssoConfig = await OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
  if (ssoConfig) {
    ssoConfig.autoProvision = true;
    await ssoConfig.save();
    console.log('✔ Enabled Auto-Provisioning for Microsoft SSO.');
  } else {
    console.log('❌ Microsoft SSO config not found.');
  }

  // 2. Update Logapriyan's email in DB to match Microsoft login email
  const user = await User.findOne({ email: 'logapriyan@ethicsec.com' });
  if (user) {
    user.email = 'logapriyanm@ethicsecur.co.in';
    await user.save();
    console.log('✔ Updated Logapriyan\'s email to logapriyanm@ethicsecur.co.in in the database.');
  } else {
    console.log('Logapriyan user account with email logapriyan@ethicsec.com was not found or already updated.');
  }

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
