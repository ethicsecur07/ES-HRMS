import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  const todayStr = '2026-05-30';

  console.log('--- Attendances for today ---');
  const attendances = await db.collection('attendances').find({ date: todayStr }).toArray();
  console.log(JSON.stringify(attendances, null, 2));

  console.log('--- Leaves covering today ---');
  const leaves = await db.collection('leaves').find({
    startDate: { $lte: new Date(todayStr) },
    endDate: { $gte: new Date(todayStr) }
  }).toArray();
  console.log(JSON.stringify(leaves, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
