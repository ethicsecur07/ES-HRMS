import mongoose from 'mongoose';
import { Organization } from './models/Organization.js';

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const org = await Organization.findOne({ slug: 'ethicsecur' });
  console.log('Organization document loaded. settings =', JSON.stringify(org?.settings, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
