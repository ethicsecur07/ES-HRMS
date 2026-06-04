import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Organization } from './src/models/Organization.js';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || '';

async function run() {
  if (!mongoURI) {
    console.error('No MONGODB_URI found in process.env');
    process.exit(1);
  }
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  try {
    const orgs = await Organization.find({});
    console.log('Registered Organizations:');
    for (const org of orgs) {
      console.log({
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        sector: org.sector,
        isActive: org.isActive,
      });
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
