import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';

dotenv.config();

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    const users = await User.find({}, 'name email role isActive');
    console.log('Registered Users in DB:');
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}) [Role: ${u.role}, Active: ${u.isActive}]`);
    });
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error listing users:', error);
  }
};

listUsers();
