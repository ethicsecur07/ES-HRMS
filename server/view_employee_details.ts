import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from './src/models/Employee';

dotenv.config();

const run = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  const employees = await Employee.find().lean();
  console.log('--- ALL EMPLOYEES FULL DATA ---');
  console.log(JSON.stringify(employees, null, 2));

  await mongoose.disconnect();
};

run();
