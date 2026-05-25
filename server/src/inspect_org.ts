import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { Organization } from './models/Organization.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const org = await Organization.findById('605c72ef1f77bcf86cd79000');
  if (org) {
    console.log('--- ORGANIZATION DETAILS ---');
    console.log('ID:', org._id);
    console.log('Name:', org.name);
    console.log('Slug:', org.slug);
    console.log('isActive:', org.isActive);
  } else {
    console.log('Organization not found!');
  }
  
  const allOrgs = await Organization.find({});
  console.log('All Orgs:');
  for (const o of allOrgs) {
    console.log(`  ID: ${o._id}, Name: ${o.name}, Slug: ${o.slug}, Active: ${o.isActive}`);
  }
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
