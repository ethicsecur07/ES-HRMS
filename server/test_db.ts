import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';
import { Employee } from './src/models/Employee';
import { Leave } from './src/models/Leave';
import { Permission } from './src/models/Permission';

dotenv.config();

const test = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  const leaves = await Leave.find().lean();
  console.log('--- LEAVES / WFH ---');
  console.log(JSON.stringify(leaves, null, 2));

  const permissions = await Permission.find().lean();
  console.log('--- PERMISSIONS ---');
  console.log(JSON.stringify(permissions, null, 2));

  await mongoose.disconnect();
};

test();
