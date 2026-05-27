const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  // Query AuditLogs
  const AuditLog = mongoose.connection.collection('auditlogs');
  console.log('\n--- FETCHING RECENT SYNC AUDIT LOGS ---');
  const syncLogs = await AuditLog.find({ action: 'EMPLOYEE_SYNC_MICROSOFT' })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  if (syncLogs.length === 0) {
    console.log('No Microsoft Sync audit logs found.');
  } else {
    syncLogs.forEach((log, index) => {
      console.log(`\nLog #${index + 1}:`);
      console.log(`  Time: ${log.createdAt}`);
      console.log(`  Details: ${log.details}`);
    });
  }

  // Query Employees count
  const Employee = mongoose.connection.collection('employees');
  const count = await Employee.countDocuments({ isDeleted: { $ne: true } });
  console.log(`\nTotal Active Employees in DB: ${count}`);

  console.log('\n--- CURRENT EMPLOYEE LIST ---');
  const employees = await Employee.find({ isDeleted: { $ne: true } }).toArray();
  employees.forEach((emp, i) => {
    console.log(`[${i+1}] Code: ${emp.employeeCode} | Name: ${emp.fullName} | Email: ${emp.email}`);
  });

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

main().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
