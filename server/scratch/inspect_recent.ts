import mongoose from 'mongoose';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Employee } from '../src/models/Employee.js';

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const orgs = await Organization.find({}).sort({ createdAt: -1 }).limit(5);
  console.log('--- Recent Organizations ---');
  console.log(JSON.stringify(orgs, null, 2));

  const users = await User.find({}).sort({ createdAt: -1 }).limit(5);
  console.log('--- Recent Users ---');
  console.log(JSON.stringify(users, null, 2));

  const employees = await Employee.find({}).sort({ createdAt: -1 }).limit(5);
  console.log('--- Recent Employees ---');
  console.log(JSON.stringify(employees, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
});
