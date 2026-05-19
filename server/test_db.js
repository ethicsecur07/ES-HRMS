import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User.js';
import { Employee } from './src/models/Employee.js';

dotenv.config();

const test = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  const users = await User.find().lean();
  console.log('--- USERS ---');
  console.log(JSON.stringify(users, null, 2));

  const employees = await Employee.find().lean();
  console.log('--- EMPLOYEES ---');
  console.log(JSON.stringify(employees, null, 2));

  await mongoose.disconnect();
};

test();
