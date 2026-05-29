import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY
} = process.env;

export let r2Client: S3Client | null = null;

if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });
  logger.info('Cloudflare R2 Client initialized successfully');
} else {
  logger.warn('Cloudflare R2 credentials not fully configured in environment. Resume uploads will fall back to Cloudinary.');
}
