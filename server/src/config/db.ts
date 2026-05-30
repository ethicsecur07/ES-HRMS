import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    logger.info('MongoDB Atlas connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed. Attempting fallback to In-Memory MongoDB...', { error });
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      logger.info('In-Memory MongoDB connected successfully as fallback');
    } catch (fallbackError) {
      logger.error('In-Memory MongoDB fallback failed', { fallbackError });
    }
  }
};
