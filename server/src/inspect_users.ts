import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const users = await User.find({});
  console.log('Total Users:', users.length);
  for (const u of users) {
    console.log(`Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}`);
  }
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
