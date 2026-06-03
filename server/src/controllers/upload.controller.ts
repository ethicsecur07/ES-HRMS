import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFileToS3 } from '../utils/s3.js';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const url = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      (req as any).user?.organizationId,
      (req as any).user?.email
    );
    res.status(200).json({ url });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const url = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      (req as any).user?.organizationId,
      (req as any).user?.email
    );
    res.status(200).json({ url });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
