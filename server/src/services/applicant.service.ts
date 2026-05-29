import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../config/r2.config.js';
import { ApplicantModel } from '../models/applicant.model.js';
import { CreateApplicantDTO } from '../dtos/applicant.dto.js';
import { uploadFileToS3 } from '../utils/s3.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class ApplicantService {
  static async uploadResume(file: Express.Multer.File): Promise<string> {
    if (r2Client && process.env.R2_BUCKET) {
      try {
        const key = `resumes/${crypto.randomUUID()}.pdf`;
        await r2Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key,
            Body: file.buffer,
            ContentType: 'application/pdf'
          })
        );
        const publicUrl = process.env.ES_PUBLIC_URL || `https://${process.env.R2_BUCKET}.r2.cloudflarestorage.com`;
        const fileUrl = `${publicUrl.replace(/\/$/, '')}/${key}`;
        logger.info(`[ApplicantService] Successfully uploaded resume to Cloudflare R2: ${fileUrl}`);
        return fileUrl;
      } catch (r2Error: any) {
        logger.error('[ApplicantService] Cloudflare R2 upload failed, falling back to S3/Cloudinary uploader', { error: r2Error.message });
      }
    }

    // Fallback to S3/Cloudinary
    logger.info('[ApplicantService] R2 not configured or failed, using Cloudinary/S3 uploader fallback.');
    return await uploadFileToS3(file.buffer, file.originalname, file.mimetype || 'application/pdf');
  }

  static async createApplicant(data: CreateApplicantDTO) {
    return ApplicantModel.create(data);
  }

  static async getAllApplicants() {
    return ApplicantModel.find().sort({ createdAt: -1 });
  }

  static async getApplicantById(id: string) {
    return ApplicantModel.findById(id);
  }
}
