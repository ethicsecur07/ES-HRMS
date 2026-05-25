import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const c = await OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
  if (c && c.clientSecret) {
    const secret = c.clientSecret;
    console.log('Secret length:', secret.length);
    
    // Check if it matches UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(secret)) {
      console.log('--- WARNING ---');
      console.log('The stored client secret IS A UUID!');
      console.log('This means you have entered the Client Secret ID instead of the Client Secret Value!');
    } else {
      console.log('The stored client secret is NOT a UUID. It appears to be a standard secret value.');
    }
  } else {
    console.log('No Microsoft config or secret found.');
  }
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
