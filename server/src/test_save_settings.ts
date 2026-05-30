import mongoose from 'mongoose';
import { Organization } from './models/Organization.js';

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const org = await Organization.findOne({ slug: 'ethicsecur' });
  if (!org) {
    console.log('Organization not found');
    await mongoose.disconnect();
    return;
  }

  console.log('Initial settings:', JSON.stringify(org.settings, null, 2));

  // Set new visibleDepartments
  if (!org.settings) org.settings = {} as any;
  org.settings.visibleDepartments = ['Development', 'Digital Marketing', 'HR'];
  org.markModified('settings');

  console.log('Saving...');
  await org.save();
  console.log('Saved!');

  // Retrieve raw document from MongoDB bypassing Mongoose schema defaults
  const db = mongoose.connection.db;
  const rawOrg = await db?.collection('organizations').findOne({ slug: 'ethicsecur' });
  console.log('Raw database document settings:', JSON.stringify(rawOrg?.settings, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
