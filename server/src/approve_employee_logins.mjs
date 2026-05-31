import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Inline User schema to avoid import issues
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  isLoginApproved: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  createdAt: Date,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const approveLogins = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB Atlas');

  // Approve all EMPLOYEE users with isLoginApproved: false
  const result = await User.updateMany(
    { role: 'EMPLOYEE', isLoginApproved: false },
    { $set: { isLoginApproved: true } }
  );
  console.log(`Updated ${result.modifiedCount} employee accounts to isLoginApproved: true`);

  // List all employees for verification
  const employees = await User.find({ role: 'EMPLOYEE' }).select('name email isLoginApproved isActive').lean();
  console.log('\n--- EMPLOYEE USERS ---');
  employees.forEach((u) => {
    console.log(`  ${u.isLoginApproved ? 'OK' : 'BLOCKED'} | ${u.name} | ${u.email} | active: ${u.isActive}`);
  });

  await mongoose.disconnect();
  console.log('\nDone.');
};

approveLogins().catch(console.error);
