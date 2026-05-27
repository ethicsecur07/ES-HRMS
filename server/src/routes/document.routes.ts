import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  getDocuments,
  uploadDocument,
  addDocumentVersion,
  downloadDocument,
  deleteDocument,
} from '../controllers/document.controller.js';

const router = Router();

router.get('/', authenticate as any, getDocuments as any);
router.post('/', authenticate as any, uploadDocument as any);
router.post('/:id/versions', authenticate as any, addDocumentVersion as any);
router.get('/:id/download', authenticate as any, downloadDocument as any);
router.delete('/:id', authenticate as any, deleteDocument as any);

export default router;
