import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from './src/models/Employee';
import { Leave } from './src/models/Leave';
import { WFHRequest } from './src/models/WFHRequest';
import { HolidayCalendar } from './src/models/HolidayCalendar';

dotenv.config();

const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
  console.log('Connecting to DB:', mongoURI);
  await mongoose.connect(mongoURI);
  console.log('Connected!');

  const employee = await Employee.findOne({ fullName: /Suseendra/i });
  if (!employee) {
    console.error('Employee Suseendra kumar R not found!');
    await mongoose.disconnect();
    return;
  }

  console.log('Found employee:', employee.fullName, 'ID:', employee._id, 'OrgID:', employee.organizationId);

  // Clear existing entries to prevent duplication or unique constraint errors
  await Leave.deleteMany({ employeeId: employee._id, startDate: '2026-06-01' });
  await WFHRequest.deleteMany({ employeeId: employee._id, startDate: '2026-06-01' });
  await HolidayCalendar.deleteMany({ organizationId: employee.organizationId, date: '2026-06-02' });

  // Create Casual Leave (APPROVED)
  const casualLeave = await Leave.create({
    organizationId: employee.organizationId,
    employeeId: employee._id,
    leaveType: 'Casual Leave',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    totalDays: 1,
    reason: 'want leave',
    status: 'APPROVED',
  });
  console.log('Created approved casual leave:', casualLeave._id);

  // Create WFH Request (REJECTED)
  const wfhReq = await WFHRequest.create({
    organizationId: employee.organizationId,
    employeeId: employee._id,
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    totalDays: 1,
    reason: 'Tasks: ftgyhnujmik',
    expectedTasks: 'ftgyhnujmik',
    status: 'REJECTED',
  });
  console.log('Created rejected WFH request:', wfhReq._id);

  // Create Holiday (June leave)
  const holiday = await HolidayCalendar.create({
    organizationId: employee.organizationId,
    name: 'June leave',
    date: '2026-06-02',
    isRestricted: true,
  });
  console.log('Created Restricted Holiday:', holiday._id);

  console.log('Done seeding successfully!');
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Error running seed script:', err);
  process.exit(1);
});
