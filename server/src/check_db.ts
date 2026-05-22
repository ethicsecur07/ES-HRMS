import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Organization } from './models/Organization.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';

dotenv.config();

const check = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  const orgs = await Organization.find().lean();
  console.log('--- ORGANIZATIONS ---');
  console.log(JSON.stringify(orgs, null, 2));

  const authConfigs = await OrganizationAuthConfig.find().lean();
  console.log('--- AUTH CONFIGS ---');
  console.log(JSON.stringify(authConfigs, null, 2));

  await mongoose.disconnect();
};

check();
