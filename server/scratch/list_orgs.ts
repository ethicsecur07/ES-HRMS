import mongoose from 'mongoose';
import { Organization } from '../src/models/Organization.js';

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const orgs = await Organization.find({}, 'name slug sector createdAt');
  console.log('Registered Organizations:');
  console.log(JSON.stringify(orgs, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
});
