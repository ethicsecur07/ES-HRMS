const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  // Check organization_auth_configs
  console.log('\n--- organization_auth_configs ---');
  const OrganizationAuthConfig = mongoose.connection.collection('organization_auth_configs');
  const configs = await OrganizationAuthConfig.find({}).toArray();
  configs.forEach(c => {
    console.log(`Provider: ${c.provider} | Enabled: ${c.isEnabled} | OrgId: ${c.organizationId} | ClientId: ${c.clientId}`);
  });

  // Check identityproviders
  console.log('\n--- identityproviders ---');
  const IdentityProvider = mongoose.connection.collection('identityproviders');
  const idps = await IdentityProvider.find({}).toArray();
  idps.forEach(i => {
    console.log(`Provider: ${i.provider} | Enabled: ${i.isEnabled} | OrgId: ${i.organizationId} | ClientId: ${i.clientId}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
