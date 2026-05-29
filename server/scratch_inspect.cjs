const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in env');
    process.exit(1);
  }
  console.log('Connecting to MONGODB...');
  await mongoose.connect(MONGODB_URI);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  await mongoose.disconnect();
}

run().catch(console.error);
