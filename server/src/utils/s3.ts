import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET
} = process.env;

let s3Client: S3Client | null = null;

if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });
  logger.info('AWS S3 Client Initialized successfully');
} else {
  logger.warn('AWS credentials not fully configured in environment. File uploads will fall back to Cloudinary.');
}

/**
 * Uploads a file buffer to S3, falling back to Cloudinary if S3 credentials are not set.
 */
export const uploadFileToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  if (s3Client && AWS_S3_BUCKET && AWS_REGION) {
    try {
      const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: AWS_S3_BUCKET,
          Key: `documents/${uniqueFileName}`,
          Body: fileBuffer,
          ContentType: mimeType,
        }
      });
      await upload.done();
      return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/documents/${uniqueFileName}`;
    } catch (error) {
      logger.error('S3 upload error, falling back to Cloudinary:', error);
    }
  }

  // Fallback to Cloudinary
  try {
    const b64 = fileBuffer.toString('base64');
    const dataURI = `data:${mimeType};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'es_hrms_documents',
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (cloudinaryError: any) {
    logger.error('Cloudinary fallback upload failed:', cloudinaryError);
    throw new Error(`Upload failed: ${cloudinaryError.message || cloudinaryError}`, { cause: cloudinaryError });
  }
};
