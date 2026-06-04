import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFileToOneDrive, generateSharingLink } from '../utils/onedrive.js';
import { UploadedFile } from '../models/UploadedFile.js';
import { uploadFileToS3 } from '../utils/s3.js';
import { logger } from '../utils/logger.js';

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  const orgId = (req as any).user?.organizationId;
  
  if (!orgId) {
    res.status(400).json({ message: 'User organization context is missing.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const userEmail = (req as any).user?.email;

    // 1. Upload file buffer to OneDrive
    const onedriveResult = await uploadFileToOneDrive(
      orgId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'uploads/profiles',
      userEmail
    );

    // 2. Generate a public sharing link
    const sharingUrl = await generateSharingLink(orgId, onedriveResult.fileId, userEmail);

    // 3. Store file metadata in MongoDB
    const fileRecord = await UploadedFile.create({
      organizationId: orgId,
      fileName: onedriveResult.fileName,
      fileId: onedriveResult.fileId,
      url: sharingUrl,
      uploadedAt: new Date(),
      mimeType: req.file.mimetype,
      size: onedriveResult.size,
    });

    logger.info(`[UploadController] Image uploaded to OneDrive: ${fileRecord.fileName} (${fileRecord.fileId})`);

    // 4. Return sharing URL and metadata
    res.status(200).json({
      success: true,
      url: fileRecord.url,
      metadata: {
        fileId: fileRecord.fileId,
        fileName: fileRecord.fileName,
        uploadedAt: fileRecord.uploadedAt,
      },
    });
  } catch (error: any) {
    logger.error('[UploadController] Error uploading image to OneDrive:', error);
    res.status(500).json({ message: error.message || 'Error uploading image to OneDrive' });
  }
};

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  const orgId = (req as any).user?.organizationId;
  
  if (!orgId) {
    res.status(400).json({ message: 'User organization context is missing.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const userEmail = (req as any).user?.email;
    // Pass organizationId and userEmail to uploadFileToS3 for OneDrive fallback compatibility
    const url = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype, orgId, userEmail);
    res.status(200).json({ url });
  } catch (error: any) {
    logger.error('[UploadController] Error uploading document:', error);
    res.status(500).json({ message: error.message || 'Error uploading document' });
  }
};
