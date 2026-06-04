import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { uploadFileToOneDrive, generateSharingLink } from './onedrive.js';
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
  logger.warn('AWS credentials not fully configured in environment. File uploads will fall back to Microsoft OneDrive.');
}

/**
 * Uploads a file buffer to S3, falling back to Cloudinary if S3 credentials are not set.
 */
export const uploadFileToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  organizationId?: string,
  userEmail?: string
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
      logger.error('S3 upload error, falling back to OneDrive:', error);
    }
  }

  try {
    const onedriveResult = await uploadFileToOneDrive(
      organizationId,
      fileBuffer,
      fileName,
      mimeType,
      'uploads/documents',
      userEmail
    );
    const sharingUrl = await generateSharingLink(organizationId, onedriveResult.fileId, userEmail);
    return sharingUrl;
  } catch (onedriveError: any) {
    logger.error('OneDrive fallback upload failed:', onedriveError);
    throw new Error(`Upload failed: ${onedriveError.message || onedriveError}`, { cause: onedriveError });
  }
};

/**
 * Fetches a file buffer from a URL, automatically handling authenticated private S3 downloads
 * or fallback HTTP fetch (with User-Agent headers) for Cloudinary.
 */
export const fetchFileBuffer = async (fileUrl: string): Promise<Buffer> => {
  // If S3 is initialized and this is an S3 URL, download it securely using GetObjectCommand
  if (s3Client && AWS_S3_BUCKET && fileUrl.includes('amazonaws.com')) {
    try {
      const url = new URL(fileUrl);
      const key = decodeURIComponent(url.pathname.substring(1));
      
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key
      }));

      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on('data', (chunk: any) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      };

      if (response.Body) {
        logger.info(`[S3 Fetch] Successfully fetched private S3 file buffer for key: ${key}`);
        return await streamToBuffer(response.Body);
      }
    } catch (s3Error: any) {
      logger.error('[S3 Fetch] Failed to download securely from S3, falling back to HTTP fetch', { error: s3Error.message });
    }
  }

  // HTTP Fetch fallback (for Cloudinary or public URLs)
  logger.info(`[HTTP Fetch] Downloading file via standard GET request with User-Agent: ${fileUrl}`);
  const response = await fetch(fileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Status ${response.status} (${response.statusText || 'Unauthorized'})`);
  }
  
  return Buffer.from(await response.arrayBuffer());
};
