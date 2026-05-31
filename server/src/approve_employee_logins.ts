import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';

dotenv.config();

const approveLogins = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB Atlas');

  // Find all users with isLoginApproved: false who have EMPLOYEE role
  const result = await User.updateMany(
    { role: 'EMPLOYEE', isLoginApproved: false },
    { $set: { isLoginApproved: true } }
  );

  console.log(`✅ Updated ${result.modifiedCount} employee user account(s) to isLoginApproved: true`);

  // Also list all EMPLOYEE users for verification
  const employees = await User.find({ role: 'EMPLOYEE' }).select('name email isLoginApproved isActive createdAt').lean();
  console.log('\n--- ALL EMPLOYEE USERS ---');
  employees.forEach(u => {
    console.log(`  ${u.isLoginApproved ? '✅' : '❌'} ${u.name} <${u.email}> | approved: ${u.isLoginApproved} | active: ${u.isActive}`);
  });

  await mongoose.disconnect();
  console.log('\nDone. Disconnected.');
};

approveLogins().catch(console.error);
