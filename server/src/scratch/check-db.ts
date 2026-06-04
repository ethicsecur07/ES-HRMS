import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { Organization } from '../models/Organization.js';

dotenv.config();

const checkDb = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Database connected.');

    // Find all Microsoft auth configs
    const configs = await OrganizationAuthConfig.find({ provider: 'MICROSOFT' });
    console.log(`Found ${configs.length} Microsoft Auth configurations:`);
    
    for (const config of configs) {
      console.log({
        organizationId: config.organizationId,
        displayName: config.displayName,
        isEnabled: config.isEnabled,
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: config.clientSecret ? '*** configured ***' : 'none',
        domain: config.domain,
      });
      
      const org = await Organization.findById(config.organizationId);
      console.log(`Organization settings for org ${config.organizationId}:`, {
        name: org?.name,
        adminEmail: org?.settings?.adminEmail,
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error checking database:', error);
  }
};

checkDb();
