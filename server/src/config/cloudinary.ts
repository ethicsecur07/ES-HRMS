import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger.js';

export const configureCloudinary = () => {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo_cloud',
      api_key: process.env.CLOUDINARY_API_KEY || 'demo_key',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'demo_secret',
    });
    logger.info('Cloudinary configured successfully');
  } catch (error) {
    logger.error('Cloudinary config error', { error });
  }
};
