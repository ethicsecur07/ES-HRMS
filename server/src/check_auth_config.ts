import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';
import { Organization } from './models/Organization.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const configs = await OrganizationAuthConfig.find({});
  console.log('Total Auth Configs:', configs.length);
  for (const c of configs) {
    console.log(`OrgId: ${c.organizationId}, Provider: ${c.provider}, Enabled: ${c.isEnabled}`);
  }
  
  const techOrg = await Organization.findOne({ slug: 'tech' });
  if (techOrg) {
    console.log('techOrg ID:', techOrg._id);
    const techConfigs = await OrganizationAuthConfig.find({ organizationId: techOrg._id });
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
